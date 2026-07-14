export async function getTemplates() {
  const res = await fetch('/prompts.json');
  return res.json();
}

const TIMEOUT_MS = 240_000;

const PROVIDER_CONFIG = {
  openai: {
    baseUrl: 'https://api.openai.com',
    authScheme: 'Bearer',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api',
    authScheme: 'Bearer',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authScheme: 'query',
  },
};

export function getModelsForProvider(provider) {
  const models = {
    openai: [
      { value: 'dall-e-3', label: 'DALL-E 3' },
      { value: 'gpt-image-2', label: 'GPT Image 2' },
    ],
    openrouter: [
      { value: 'google/gemini-3.1-flash-image', label: 'Nano Banana 2' },
      { value: 'openai/gpt-image-2', label: 'GPT Image 2' },
      { value: 'black-forest-labs/flux.2-pro', label: 'FLUX.2 Pro' },
    ],
    gemini: [
      { value: 'gemini-2.0-flash-exp-image-stable', label: 'Gemini 2.0 Flash Image' },
    ],
  };
  return models[provider] || [];
}

function getVisionModel(provider) {
  const models = {
    openai: 'gpt-4o',
    openrouter: 'google/gemini-2.5-flash',
    gemini: 'gemini-1.5-flash',
  };
  return models[provider] || 'gpt-4o';
}

function stripDataUriPrefix(dataUri) {
  const comma = dataUri.indexOf(',');
  return comma !== -1 ? dataUri.slice(comma + 1) : dataUri;
}

function getMimeFromDataUri(dataUri) {
  const match = dataUri.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
}

async function openaiCompatibleFetch({ endpoint, body, provider, apiKey, signal }) {
  const config = PROVIDER_CONFIG[provider];
  const url = `${config.baseUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.authScheme === 'Bearer') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const finalUrl = config.authScheme === 'query' ? `${url}?key=${apiKey}` : url;

  const response = await fetch(finalUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  return response.json();
}

async function generateImageOpenAICompatible({ prompt, images, model, provider, apiKey }) {
  const rawImages = images?.map((img) => img.src || img) || [];
  const primaryImage = rawImages[0] || null;

  let finalPrompt = prompt;
  const requestBody = {
    model,
    prompt: finalPrompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  };

  if (primaryImage) {
    requestBody.input_references = rawImages.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }));

    if (provider !== 'openrouter') {
      requestBody.images = rawImages;
      requestBody.image = primaryImage;
      requestBody.image_url = primaryImage;
      requestBody.init_image = primaryImage;
      finalPrompt = `${prompt}\n[Use the provided reference image as the face/identity reference]\n[Reference Image: ${primaryImage}]`;
    }
  }

  requestBody.prompt = finalPrompt;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const data = await openaiCompatibleFetch({
      endpoint: '/v1/images/generations',
      body: requestBody,
      provider,
      apiKey,
      signal: controller.signal,
    });

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image in response');
    }

    return {
      id: data.created?.toString() || Date.now().toString(),
      prompt,
      images: rawImages,
      status: 'completed',
      resultUrl: `data:image/png;base64,${b64}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateImageGemini({ prompt, images, model, apiKey }) {
  const rawImages = images?.map((img) => img.src || img) || [];
  const primaryImage = rawImages[0] || null;

  const parts = [{ text: prompt }];

  if (primaryImage) {
    parts.push({
      inline_data: {
        mime_type: getMimeFromDataUri(primaryImage),
        data: stripDataUriPrefix(primaryImage),
      },
    });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    },
  };

  const url = `${PROVIDER_CONFIG.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inline_data);

    if (!imagePart) {
      throw new Error('No image in Gemini response');
    }

    const mime = imagePart.inline_data.mime_type || 'image/png';
    const b64 = imagePart.inline_data.data;

    return {
      id: Date.now().toString(),
      prompt,
      images: rawImages,
      status: 'completed',
      resultUrl: `data:${mime};base64,${b64}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage({ prompt, images, model, provider, apiKey }) {
  if (!apiKey) {
    throw new Error('API key is required. Set it in the settings above.');
  }

  if (provider === 'gemini') {
    return generateImageGemini({ prompt, images, model, apiKey });
  }
  return generateImageOpenAICompatible({ prompt, images, model, provider, apiKey });
}

async function describeImageOpenAICompatible({ base64Image, model, provider, apiKey }) {
  const targetModel = model || getVisionModel(provider);

  const body = {
    model: targetModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this image in extreme detail, focusing on style, facial features, hair, clothing, background, composition, lighting, and mood. Write a dense descriptive paragraph of under 120 words that can be fed into an image generator to replicate this exact image reference.',
          },
          {
            type: 'image_url',
            image_url: { url: base64Image },
          },
        ],
      },
    ],
  };

  const data = await openaiCompatibleFetch({
    endpoint: '/v1/chat/completions',
    body,
    provider,
    apiKey,
  });

  return data.choices?.[0]?.message?.content || '';
}

async function describeImageGemini({ base64Image, model, apiKey }) {
  const targetModel = model || getVisionModel('gemini');

  const body = {
    contents: [
      {
        parts: [
          {
            text: 'Describe this image in extreme detail, focusing on style, facial features, hair, clothing, background, composition, lighting, and mood. Write a dense descriptive paragraph of under 120 words that can be fed into an image generator to replicate this exact image reference.',
          },
          {
            inline_data: {
              mime_type: getMimeFromDataUri(base64Image),
              data: stripDataUriPrefix(base64Image),
            },
          },
        ],
      },
    ],
  };

  const url = `${PROVIDER_CONFIG.gemini.baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function describeImage({ base64Image, model, provider, apiKey }) {
  if (!apiKey) {
    throw new Error('API key is required. Set it in the settings above.');
  }

  if (provider === 'gemini') {
    return describeImageGemini({ base64Image, model, apiKey });
  }
  return describeImageOpenAICompatible({ base64Image, model, provider, apiKey });
}
