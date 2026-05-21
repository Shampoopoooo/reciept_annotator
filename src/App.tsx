import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Camera, Calculator, FileText, CheckCircle, AlertCircle, RefreshCcw, Download } from "lucide-react";

interface ReceiptResult {
  amount_before_tax: number;
  receipt: {
    data: string;
    mimeType: string;
  };
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState<string>("8.875");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleAnnotate = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("tax_rate", taxRate);

    try {
      const response = await fetch("/annotate_receipt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process receipt");
      }

      const data: ReceiptResult = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadAnnotated = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:${result.receipt.mimeType};base64,${result.receipt.data}`;
    link.download = `annotated_receipt_${taxRate}pct.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900 selection:bg-yellow-200">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold">
              R
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Receipt Annotator</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Student: Rosina Zhou</span>
              <span className="text-sm font-mono font-medium">EMPL_ID: 24560131</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-neutral-400" />
                <h2 className="font-semibold">Upload Receipt</h2>
              </div>
              
              <div 
                className={`relative border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center p-8 gap-4 cursor-pointer hover:border-black group ${
                  preview ? "border-black/10 aspect-auto" : "border-neutral-200 aspect-square"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !preview && fileInputRef.current?.click()}
              >
                {preview ? (
                  <div className="relative w-full overflow-hidden rounded-lg shadow-inner bg-neutral-50">
                    <img src={preview} alt="Preview" className="w-full h-auto block select-none" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                      className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center group-hover:bg-yellow-100 group-hover:scale-110 transition-all">
                      <Camera className="w-6 h-6 text-neutral-500 group-hover:text-yellow-600" />
                    </div>
                    <div className="text-center group">
                      <p className="text-sm font-medium">Click to upload or drag & drop</p>
                      <p className="text-xs text-neutral-400 mt-1 uppercase tracking-tight">PNG, JPG up to 10MB</p>
                    </div>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {file && (
                <div className="mt-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold block">
                      Target Tax Rate (%)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        step="0.01"
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 bg-neutral-100 rounded-lg border-neutral-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all font-mono"
                        placeholder="e.g. 8.875"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 font-mono">
                        %
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleAnnotate}
                    disabled={isProcessing || !file}
                    className="w-full bg-black text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <RefreshCcw className="w-5 h-5" />
                        </motion.div>
                        Extracting & Annotating...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-5 h-5" />
                        Annotate Receipt
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.section 
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h2 className="font-bold text-xl uppercase tracking-tight">Processing Complete</h2>
                          <p className="text-sm text-neutral-500">Receipt information extracted successfully</p>
                        </div>
                      </div>
                      <button 
                        onClick={downloadAnnotated}
                        className="p-2 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-lg transition-all"
                        title="Download Result"
                      >
                        <Download className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                        <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold block mb-1">
                          Original Pre-Tax Amount
                        </span>
                        <span className="text-3xl font-mono font-bold">
                          ${result.amount_before_tax.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                        <span className="text-[10px] uppercase tracking-widest text-yellow-600/60 font-bold block mb-1">
                          Calculated Total ({taxRate}%)
                        </span>
                        <span className="text-3xl font-mono font-bold text-yellow-900">
                          ${(result.amount_before_tax * (1 + parseFloat(taxRate) / 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold block">
                        Annotated Output
                      </span>
                      <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm bg-neutral-100 group relative">
                        <img 
                          src={`data:${result.receipt.mimeType};base64,${result.receipt.data}`} 
                          alt="Annotated Receipt" 
                          className="w-full h-auto block"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </motion.section>
              ) : (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center p-12 text-center text-neutral-400"
                >
                  <FileText className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-lg font-medium">Waiting for your receipt upload...</p>
                  <p className="text-sm max-w-xs mt-2">
                    Once you upload a photo and click annotate, the results will appear here.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-12 mt-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400 uppercase tracking-[0.2em] font-bold">
            CSC 221 - Final Challenge: Receipt Annotation
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
             <span className="text-sm font-mono font-medium text-neutral-600">Student: Rosina Zhou</span>
             <span className="text-sm font-mono font-medium text-neutral-600 underline">EMPL_ID: 24560131</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

