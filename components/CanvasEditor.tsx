import React, { useRef, useLayoutEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { UploadedFile } from '../types';
import { PencilIcon, EraserIcon, MoveIcon, LineIcon, RectangleIcon, CircleIcon, ImageIcon } from './icons';

// Types
interface CanvasEditorProps {
  uploadedFiles: UploadedFile[];
}

type Tool = 'move' | 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle';
type Action = 'none' | 'drawing' | 'dragging' | 'resizing';
type Point = { x: number; y: number };
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

interface PlacedImage {
  id: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasElement {
  id: string;
  tool: Tool;
  points: Point[];
  color: string;
  width: number;
}

// Helper functions
const isDrawingTool = (tool: Tool) => ['pencil', 'line', 'rectangle', 'circle', 'eraser'].includes(tool);
const canChangeColor = (tool: Tool) => ['pencil', 'line', 'rectangle', 'circle'].includes(tool);

const getHandleAtPosition = (x: number, y: number, image: PlacedImage): ResizeHandle | null => {
    const handleSize = 10;
    const handles: Record<ResizeHandle, Point> = {
        tl: { x: image.x, y: image.y },
        tr: { x: image.x + image.width, y: image.y },
        bl: { x: image.x, y: image.y + image.height },
        br: { x: image.x + image.width, y: image.y + image.height },
    };

    for (const [name, pos] of Object.entries(handles)) {
        if (x >= pos.x - handleSize / 2 && x <= pos.x + handleSize / 2 &&
            y >= pos.y - handleSize / 2 && y <= pos.y + handleSize / 2) {
            return name as ResizeHandle;
        }
    }
    return null;
};

const getCursorForHandle = (handle: ResizeHandle | null): string => {
    switch (handle) {
        case 'tl': case 'br': return 'nwse-resize';
        case 'tr': case 'bl': return 'nesw-resize';
        default: return 'move';
    }
};


const CanvasEditor = forwardRef<{ getCanvasAsBase64: () => string | null }, CanvasEditorProps>(({ uploadedFiles }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  
  const [activeTool, setActiveTool] = useState<Tool>('move');
  const [action, setAction] = useState<Action>('none');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [mousePosition, setMousePosition] = useState<Point | null>(null);
  
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF');
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvasAsBase64: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');

      if (ctx) {
         if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, tempCanvas.width, tempCanvas.height);
          } else {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          }
        ctx.drawImage(canvas, 0, 0);
      }
      
      return tempCanvas.toDataURL('image/jpeg').split(',')[1];
    },
  }));
  
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const drawElement = (el: CanvasElement) => {
      ctx.beginPath();
      ctx.strokeStyle = el.tool === 'eraser' ? backgroundColor : el.color;
      ctx.lineWidth = el.tool === 'eraser' ? 20 : el.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if ((el.tool === 'pencil' || el.tool === 'eraser') && el.points.length > 0) {
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.forEach(point => ctx.lineTo(point.x, point.y));
      } else if (el.tool === 'line' && el.points.length > 1) {
        ctx.moveTo(el.points[0].x, el.points[0].y);
        ctx.lineTo(el.points[1].x, el.points[1].y);
      } else if (el.tool === 'rectangle' && el.points.length > 1) {
        const start = el.points[0];
        const end = el.points[1];
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (el.tool === 'circle' && el.points.length > 1) {
        const start = el.points[0];
        const end = el.points[1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();
    };

    elements.forEach(drawElement);
    if (selectedElement) drawElement(selectedElement);

    placedImages.forEach((img, index) => {
      ctx.drawImage(img.image, img.x, img.y, img.width, img.height);
      if (selectedImageIndex === index) {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.strokeRect(img.x, img.y, img.width, img.height);
        
        const handleSize = 8;
        const handles: Point[] = [
            { x: img.x, y: img.y }, { x: img.x + img.width, y: img.y },
            { x: img.x, y: img.y + img.height }, { x: img.x + img.width, y: img.y + img.height }
        ];
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        handles.forEach(handle => {
            ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
      }
    });

    if (mousePosition && isDrawingTool(activeTool) && action === 'none') {
        ctx.strokeStyle = activeTool === 'eraser' ? '#000000' : strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const radius = (activeTool === 'eraser' ? 20 : strokeWidth) / 2;
        ctx.arc(mousePosition.x, mousePosition.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
  });
  
  const getMousePos = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (activeTool === 'move') {
      if(selectedImageIndex !== null) {
        const handle = getHandleAtPosition(pos.x, pos.y, placedImages[selectedImageIndex]);
        if(handle){
          setAction('resizing');
          setResizeHandle(handle);
          return;
        }
      }

      const imageIndex = placedImages.findIndex(img => 
        pos.x >= img.x && pos.x <= img.x + img.width &&
        pos.y >= img.y && pos.y <= img.y + img.height
      );

      if (imageIndex !== -1) {
        setAction('dragging');
        setSelectedImageIndex(imageIndex);
      } else {
        setSelectedImageIndex(null);
      }
    } else {
        setAction('drawing');
        const newElement: CanvasElement = {
            id: crypto.randomUUID(),
            tool: activeTool,
            points: [pos],
            color: strokeColor,
            width: strokeWidth
        };
        setSelectedElement(newElement);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    setMousePosition(pos);
    const canvas = canvasRef.current;
    if (canvas) {
        if (action === 'none' && activeTool === 'move' && selectedImageIndex !== null) {
            const handle = getHandleAtPosition(pos.x, pos.y, placedImages[selectedImageIndex]);
            canvas.style.cursor = getCursorForHandle(handle);
        } else if (action === 'none') {
             canvas.style.cursor = isDrawingTool(activeTool) ? 'none' : 'default';
        }
    }


    if (action === 'dragging' && selectedImageIndex !== null) {
      setPlacedImages(prev => {
        const newImages = [...prev];
        const img = newImages[selectedImageIndex];
        img.x += e.movementX;
        img.y += e.movementY;
        return newImages;
      });
    } else if (action === 'resizing' && selectedImageIndex !== null && resizeHandle) {
        const { x, y } = pos;
        setPlacedImages(prev => {
            const newImages = [...prev];
            const img = { ...newImages[selectedImageIndex] };
            const originalX = img.x;
            const originalY = img.y;
            const originalWidth = img.width;
            const originalHeight = img.height;

            switch(resizeHandle) {
                case 'tl':
                    img.width = originalX + originalWidth - x;
                    img.height = originalY + originalHeight - y;
                    img.x = x;
                    img.y = y;
                    break;
                case 'tr':
                    img.width = x - originalX;
                    img.height = originalY + originalHeight - y;
                    img.y = y;
                    break;
                case 'bl':
                    img.width = originalX + originalWidth - x;
                    img.height = y - originalY;
                    img.x = x;
                    break;
                case 'br':
                    img.width = x - originalX;
                    img.height = y - originalY;
                    break;
            }
            if(img.width > 10 && img.height > 10) newImages[selectedImageIndex] = img;
            return newImages;
        });
    } else if (action === 'drawing' && selectedElement) {
        const tool = selectedElement.tool;
        if ((tool === 'pencil' || tool === 'eraser') ) {
            setSelectedElement(prev => ({...prev!, points: [...prev!.points, pos]}));
        } else {
            setSelectedElement(prev => ({...prev!, points: [prev!.points[0], pos]}));
        }
    }
  };

  const handleMouseUp = () => {
    if (action === 'drawing' && selectedElement) {
        setElements(prev => [...prev, selectedElement]);
    }
    setAction('none');
    setSelectedElement(null);
    setResizeHandle(null);
  };
  
  const addImageToCanvas = (file: UploadedFile) => {
    const img = new Image();
    img.src = file.previewUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const MAX_WIDTH = 150;
        const scale = MAX_WIDTH / img.width;
        const newWidth = MAX_WIDTH;
        const newHeight = img.height * scale;

      setPlacedImages(prev => [...prev, {
        id: file.id,
        image: img,
        x: 50,
        y: 50,
        width: newWidth,
        height: newHeight
      }]);
    };
  };

  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackgroundColor(e.target.value);
    setBackgroundImage(null);
  };

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setBackgroundImage(img);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset file input
    }
  };


  // FIX: Explicitly type ToolButton as a React.FC and define its props to resolve a TypeScript inference issue
  // where children were not being correctly identified when the component is defined within another component.
  type ToolButtonProps = { tool: Tool; children: React.ReactNode };
  const ToolButton: React.FC<ToolButtonProps> = ({ tool, children }) => (
    <button onClick={() => { setActiveTool(tool); setSelectedImageIndex(null); }} className={`p-2 rounded-md transition-colors ${activeTool === tool ? 'bg-amber-800 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}>
        {children}
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-shrink-0 md:w-40">
        <h4 className="font-semibold mb-2 text-stone-700">Your Furniture</h4>
        <div className="space-y-2">
            {uploadedFiles.map(file => (
                <div key={file.id} onClick={() => addImageToCanvas(file)} className="cursor-pointer border-2 border-transparent hover:border-amber-500 rounded-lg p-1">
                    <img src={file.previewUrl} alt={file.file.name} className="w-full h-auto object-contain rounded-md bg-stone-100" />
                </div>
            ))}
        </div>
      </div>
      <div className="flex-grow">
         <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-stone-100 rounded-lg">
            <ToolButton tool="move"><MoveIcon className="w-5 h-5" /></ToolButton>
            <ToolButton tool="pencil"><PencilIcon className="w-5 h-5" /></ToolButton>
            <ToolButton tool="eraser"><EraserIcon className="w-5 h-5" /></ToolButton>
            <ToolButton tool="line"><LineIcon className="w-5 h-5" /></ToolButton>
            <ToolButton tool="rectangle"><RectangleIcon className="w-5 h-5" /></ToolButton>
            <ToolButton tool="circle"><CircleIcon className="w-5 h-5" /></ToolButton>

            <div className="h-6 border-l border-stone-300 mx-2"></div>

            {isDrawingTool(activeTool) && (
                <>
                {canChangeColor(activeTool) && (
                    <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-8 h-8 p-0.5 border-none rounded-md cursor-pointer bg-stone-100" title="Select color" />
                )}
                <div className="flex items-center space-x-2">
                    <input type="range" min="1" max="50" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24" title="Adjust stroke width" />
                    <span className="text-sm w-6 text-right">{strokeWidth}</span>
                </div>
                </>
            )}
             <div className="h-6 border-l border-stone-300 mx-2"></div>
                <span className="text-sm font-medium text-stone-600 mr-2">BG:</span>
                <input 
                    type="color" 
                    value={backgroundColor} 
                    onChange={handleBackgroundColorChange} 
                    className="w-8 h-8 p-0.5 border-none rounded-md cursor-pointer bg-stone-100" 
                    title="Select background color" 
                />
                <label htmlFor="bg-upload" className="p-2 rounded-md transition-colors bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer" title="Upload background image">
                    <ImageIcon className="w-5 h-5" />
                    <input type="file" id="bg-upload" accept="image/*" className="sr-only" onChange={handleBackgroundImageUpload} />
                </label>
         </div>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-auto border border-stone-300 rounded-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setMousePosition(null); }}
        />
      </div>
    </div>
  );
});

export default CanvasEditor;