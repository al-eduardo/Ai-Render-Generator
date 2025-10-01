import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { BASE_RENDER_PROMPT } from '../constants';
import { UploadedFile } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove the `data:mime/type;base64,` prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface GenerationOptions {
    location?: string;
    description?: string;
    canvasImage?: string; // base64 string without prefix
}


export const generateRenderings = async (files: UploadedFile[], options: GenerationOptions = {}, numImages: number = 1): Promise<string[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const base64Images = await Promise.all(files.map(f => fileToBase64(f.file)));
    const imageParts = [];

    let prompt = BASE_RENDER_PROMPT;

    const dimensionDetails = files.map((f, i) => {
        if (f.width && f.height) {
            return `- Furniture piece seen in image #${i+1}: Width ${f.width}${f.units}, Height ${f.height}${f.units}${f.depth ? `, Depth ${f.depth}${f.units}` : ''}.`;
        }
        return null;
    }).filter(Boolean).join('\n');
    
    let dimensionPrompt = '';
    if (dimensionDetails) {
        dimensionPrompt = `\n\nPlease adhere to the following furniture dimensions to ensure realistic proportions and scale within the scene:\n${dimensionDetails}`;
    }

    if (options.canvasImage) {
        prompt = `Using the provided canvas sketch as a layout guide, create a super realistic interior design rendering. The sketch shows the desired placement of furniture and custom drawings. High-resolution versions of the furniture items are also provided for detail. ${BASE_RENDER_PROMPT} ${dimensionPrompt}`;
        imageParts.push({
            inlineData: {
                data: options.canvasImage,
                mimeType: 'image/jpeg',
            }
        });
    } else {
        if (options.location) {
            prompt += ` The room should be a ${options.location}.`;
        }
        if (options.description) {
            prompt += ` Additional details: ${options.description}.`;
        }
        prompt += dimensionPrompt;
    }

    const furnitureImageParts = base64Images.map((b64, index) => ({
      inlineData: {
        data: b64,
        mimeType: files[index].file.type,
      },
    }));

    imageParts.push(...furnitureImageParts);

    const textPart = { text: prompt };

    const contents = {
      parts: [...imageParts, textPart],
    };
    
    // The model does not support candidateCount, so we make parallel requests
    const generationPromises: Promise<GenerateContentResponse>[] = [];
    for (let i = 0; i < numImages; i++) {
        generationPromises.push(
            ai.models.generateContent({
              model: 'gemini-2.5-flash-image-preview',
              contents: contents,
              config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
              },
            })
        );
    }
    
    const responses = await Promise.all(generationPromises);

    const generatedImages: string[] = [];
    for (const response of responses) {
      if (response.candidates && response.candidates.length > 0) {
        for (const candidate of response.candidates) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const base64ImageBytes = part.inlineData.data;
              const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
              generatedImages.push(imageUrl);
              break; // Assuming one image per candidate
            }
          }
        }
      }
    }
    
    if (generatedImages.length === 0) {
        throw new Error("The model did not return any images. Please try again with different furniture.");
    }

    return generatedImages;

  } catch (error) {
    console.error("Error generating renderings:", error);
    if (error instanceof Error) {
        if (error.message.includes('400')) {
             throw new Error("The request was invalid. Please check the uploaded images and try again. It's possible one of the images is in a format the model cannot process.");
        }
    }
    throw new Error("Failed to generate interior design renderings. Please check the console for details.");
  }
};