async function listModels() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/images/models");
    const json = await response.json();
    console.log("Status:", response.status);
    const models = json.data || [];
    console.log(`Found ${models.length} image models.`);
    
    // Filter models that support input_references
    const supporting = models.filter(m => m.supported_parameters?.input_references);
    
    console.log("\nModels supporting input_references (image-to-image):");
    supporting.forEach(m => {
      console.log(`- ID: ${m.id}`);
      console.log(`  Name: ${m.name}`);
      console.log(`  Input References Limit: min=${m.supported_parameters.input_references.min}, max=${m.supported_parameters.input_references.max}`);
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

listModels();
