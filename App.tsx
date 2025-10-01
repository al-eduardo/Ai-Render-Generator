import React, { useState, useCallback, useRef } from 'react';
import { UploadedFile } from './types';
import { generateRenderings } from './services/geminiService';
import { UploadIcon, CloseIcon, SparklesIcon, AlertIcon, DownloadIcon } from './components/icons';
import Spinner from './components/Spinner';
import CanvasEditor from './components/CanvasEditor';

const App: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New state for user customization
  const [location, setLocation] = useState<string>('livingroom');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [userDescription, setUserDescription] = useState<string>('');
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const canvasRef = useRef<{ getCanvasAsBase64: () => string | null }>(null);
  
  // State for image carousel
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  
  // State for number of images to generate
  const [numImages, setNumImages] = useState<number>(4);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Fix: Explicitly type `file` as `File` to resolve a potential TypeScript inference issue.
      const newFiles = Array.from(event.target.files).map((file: File): UploadedFile => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        width: '',
        height: '',
        depth: '',
        units: 'cm',
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleDimensionChange = (id: string, field: 'width' | 'height' | 'depth' | 'units', value: string) => {
    setUploadedFiles(prev => 
      prev.map(f => f.id === id ? { ...f, [field]: value } : f)
    );
  };

  const handleGenerate = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setError("Please upload at least one furniture image.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);

    try {
      let canvasImage: string | undefined = undefined;
      if (isAdvancedMode && canvasRef.current) {
          const b64 = canvasRef.current.getCanvasAsBase64();
          if (b64) {
            canvasImage = b64;
          }
      }

      const finalLocation = location === 'other' ? customLocation : location;

      const results = await generateRenderings(uploadedFiles, {
        location: isAdvancedMode ? undefined : finalLocation,
        description: userDescription,
        canvasImage: canvasImage,
      }, numImages);

      setGeneratedImages(results);
      setActiveImageIndex(0);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles, isAdvancedMode, location, customLocation, userDescription, numImages]);

  const handleDownload = () => {
    const imageSrc = generatedImages[activeImageIndex];
    if (!imageSrc) return;

    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `interior-design-${activeImageIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const locationOptions = [
    { id: 'livingroom', name: 'Living Room' },
    { id: 'bedroom', name: 'Bedroom' },
    { id: 'bathroom', name: 'Bathroom' },
    { id: 'outdoor', name: 'Outdoor' },
    { id: 'other', name: 'Other' },
  ];

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      <main className="container mx-auto px-4 py-8 md:py-16">
        <header className="text-center mb-12">
          <div className="inline-block bg-amber-100 text-amber-800 p-4 rounded-full mb-4">
            <SparklesIcon className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900">AI Interior Designer</h1>
          <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
            Upload images of your furniture (on a white background) and watch as AI creates stunning, realistic interior designs.
          </p>
        </header>

        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-10 border border-stone-200">
          {/* STEP 1: UPLOAD */}
          <section>
            <h2 className="text-2xl font-semibold mb-2">1. Upload Your Furniture</h2>
            <p className="text-stone-500 mb-6">You can upload up to 5 images. For best results, use photos with a plain, white background. Provide dimensions for accurate scaling.</p>
            <label htmlFor="file-upload" className="relative cursor-pointer bg-stone-100 hover:bg-stone-200 transition-colors border-2 border-dashed border-stone-300 rounded-xl p-8 w-full flex flex-col items-center justify-center text-center">
              <UploadIcon className="w-12 h-12 text-stone-400 mb-4" />
              <span className="text-lg font-medium text-stone-700">Click to upload files</span>
              <span className="text-sm text-stone-500">PNG, JPG, WEBP recommended</span>
              <input id="file-upload" name="file-upload" type="file" multiple accept="image/*" className="sr-only" onChange={handleFileChange} />
            </label>
            {uploadedFiles.length > 5 && (
              <div className="mt-4 flex items-start p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                <AlertIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                <div><h3 className="font-semibold">Too many images</h3><p className="text-sm">You've uploaded more than 5 images. Results may not be as expected.</p></div>
              </div>
            )}
          </section>

          {uploadedFiles.length > 0 && (
            <section className="mt-8">
              <h3 className="font-semibold text-lg mb-4">Your Furniture ({uploadedFiles.length})</h3>
              <div className="space-y-4">
                {uploadedFiles.map(file => (
                    <div key={file.id} className="flex flex-col sm:flex-row items-start gap-4 p-3 border border-stone-200 rounded-lg bg-white">
                        <div className="relative w-24 h-24 flex-shrink-0 group">
                            <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-contain rounded-lg border border-stone-200 p-1" />
                            <button onClick={() => handleRemoveFile(file.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-grow w-full">
                            <p className="text-sm font-medium text-stone-800 truncate" title={file.file.name}>{file.file.name}</p>
                            <p className="text-xs text-stone-500 mb-2">Dimensions (optional)</p>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <input type="number" placeholder="Width" value={file.width || ''} onChange={e => handleDimensionChange(file.id, 'width', e.target.value)} className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2" />
                                <input type="number" placeholder="Height" value={file.height || ''} onChange={e => handleDimensionChange(file.id, 'height', e.target.value)} className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2" />
                                <input type="number" placeholder="Depth" value={file.depth || ''} onChange={e => handleDimensionChange(file.id, 'depth', e.target.value)} className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2" />
                                <select value={file.units || 'cm'} onChange={e => handleDimensionChange(file.id, 'units', e.target.value as 'cm' | 'in')} className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2">
                                    <option value="cm">cm</option>
                                    <option value="in">in</option>
                                </select>
                             </div>
                        </div>
                    </div>
                ))}
              </div>
            </section>
          )}

          {/* STEP 2: CUSTOMIZE */}
          {uploadedFiles.length > 0 && (
             <section className="mt-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">2. Describe Your Scene</h2>
                    <div className="flex items-center">
                        <span className={`mr-3 text-sm font-medium ${isAdvancedMode ? 'text-stone-400' : 'text-stone-800'}`}>Simple</span>
                        <label htmlFor="advanced-mode-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="advanced-mode-toggle" className="sr-only peer" checked={isAdvancedMode} onChange={() => setIsAdvancedMode(!isAdvancedMode)} />
                            <div className="w-11 h-6 bg-stone-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-amber-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-800"></div>
                        </label>
                         <span className={`ml-3 text-sm font-medium ${!isAdvancedMode ? 'text-stone-400' : 'text-stone-800'}`}>Advanced</span>
                    </div>
                </div>

                {!isAdvancedMode ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-md font-semibold text-stone-700 mb-3">Room Type</label>
                      <div className="flex flex-wrap gap-2">
                        {locationOptions.map(opt => (
                           <button key={opt.id} onClick={() => setLocation(opt.id)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${location === opt.id ? 'bg-amber-800 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}>
                                {opt.name}
                           </button>
                        ))}
                      </div>
                    </div>
                     {location === 'other' && (
                        <input type="text" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} placeholder="e.g., Home Office" className="mt-2 block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3" />
                     )}
                     <div>
                        <label htmlFor="description" className="block text-md font-semibold text-stone-700 mb-2">Description (Optional)</label>
                        <textarea id="description" rows={3} value={userDescription} onChange={(e) => setUserDescription(e.target.value)} placeholder="e.g., A cozy room with large windows and light wood floors." className="block w-full rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3"></textarea>
                    </div>
                  </div>
                ) : (
                    <CanvasEditor ref={canvasRef} uploadedFiles={uploadedFiles} />
                )}
             </section>
          )}

          {/* STEP 3: GENERATE */}
           {uploadedFiles.length > 0 && (
            <section className="mt-10 text-center">
                <div className="mb-6 max-w-sm mx-auto">
                    <label htmlFor="num-images-slider" className="block text-md font-semibold text-stone-700 mb-3">Number of Designs: <span className="font-bold text-amber-800">{numImages}</span></label>
                    <input id="num-images-slider" type="range" min="1" max="10" value={numImages} onChange={(e) => setNumImages(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-800" />
                </div>
                <button
                onClick={handleGenerate}
                disabled={isLoading || uploadedFiles.length === 0}
                className="bg-amber-800 hover:bg-amber-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 ease-in-out transform hover:scale-105 shadow-md hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-amber-800 focus:ring-opacity-50 inline-flex items-center justify-center"
                >
                {isLoading ? (<><Spinner /><span className="ml-3">Generating...</span></>) : (<><SparklesIcon className="w-6 h-6 mr-3" />Generate Design</>)}
                </button>
            </section>
           )}
        </div>

        {error && (
            <div className="mt-8 max-w-4xl mx-auto flex items-start p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
                 <AlertIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                 <div><h3 className="font-semibold">An Error Occurred</h3><p className="text-sm">{error}</p></div>
            </div>
        )}

        {generatedImages.length > 0 && !isLoading && (
          <section className="mt-16">
            <h2 className="text-3xl font-bold text-center mb-8">Your Generated Interiors</h2>
             <div className="relative max-w-3xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-stone-200 aspect-[4/3] flex items-center justify-center">
                    <img 
                        key={activeImageIndex}
                        src={generatedImages[activeImageIndex]} 
                        alt={`Generated Interior ${activeImageIndex + 1}`} 
                        className="w-full h-full object-contain animate-[fade-in_0.5s_ease-in-out]" 
                    />
                </div>

                {generatedImages.length > 1 && (
                    <>
                    <button
                        onClick={() => setActiveImageIndex(prev => (prev - 1 + generatedImages.length) % generatedImages.length)}
                        className="absolute top-1/2 left-0 sm:-left-4 md:-left-16 transform -translate-y-1/2 bg-white/80 hover:bg-white backdrop-blur-sm text-stone-800 rounded-full p-3 shadow-lg transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                        aria-label="Previous Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setActiveImageIndex(prev => (prev + 1) % generatedImages.length)}
                        className="absolute top-1/2 right-0 sm:-right-4 md:-right-16 transform -translate-y-1/2 bg-white/80 hover:bg-white backdrop-blur-sm text-stone-800 rounded-full p-3 shadow-lg transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                        aria-label="Next Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    </>
                )}

                {generatedImages.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 p-2 bg-black/20 backdrop-blur-sm rounded-full">
                        {generatedImages.map((_, index) => (
                            <button
                            key={index}
                            onClick={() => setActiveImageIndex(index)}
                            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${index === activeImageIndex ? 'bg-white' : 'bg-white/50 hover:bg-white'}`}
                            aria-label={`Go to image ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
                 <div className="flex justify-center items-center mt-4 gap-4">
                    <p className="text-stone-500 font-medium text-sm">
                        Showing {activeImageIndex + 1} of {generatedImages.length}
                    </p>
                    <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 border border-stone-300 text-sm font-medium rounded-md shadow-sm text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        Download
                    </button>
                 </div>
            </div>
          </section>
        )}
      </main>
      <footer className="text-center py-8 text-stone-500">
        <p>Powered by Gemini API</p>
      </footer>
       <style>{`
        @keyframes fade-in {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: #fff;
            border: 2px solid #92400e;
            border-radius: 50%;
            cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #fff;
            border: 2px solid #92400e;
            border-radius: 50%;
            cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default App;