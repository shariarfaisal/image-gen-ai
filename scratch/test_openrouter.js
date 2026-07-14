const baseUrl = "https://litellm.tubeonai.com";
const apiKey = "sk-ju5kX8S7yCq6KPDjdO4Grw";
const model = "FLUX-1.1-pro";

// A tiny 1x1 black pixel base64 image
const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function test() {
  try {
    console.log("Sending request to FLUX model with input_references:", model);
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: "A beautiful space landscape based on the reference",
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        input_references: [
          {
            type: "image_url",
            image_url: {
              url: testImage
            }
          }
        ]
      })
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.slice(0, 1000));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
