"use client";

import { useState, useEffect } from "react";
import { ScraperAISession } from "@/lib/services/scraper-session-service";
import { Button } from "@/components/ui/button";
import { XCircle, AlertCircle, ArrowLeft, RefreshCw, Save } from "lucide-react";

interface AiScriptAssemblyProps {
  session: ScraperAISession;
  onComplete: (scraperId: string) => void;
  onBack: () => void;
}

export default function AiScriptAssembly({ session, onComplete, onBack }: AiScriptAssemblyProps) {
  const [loading, setLoading] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptContent, setScriptContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const assemblyData = session.assemblyData;

  useEffect(() => {
    if (assemblyData && assemblyData.assembledScript) {
      setScriptContent(assemblyData.assembledScript);
    }
  }, [assemblyData]);

  if (!assemblyData) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">No assembly data available</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>Please assemble the script first.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAssemble = async () => {
    try {
      setAssembling(true);
      setError(null);

      const response = await fetch(`/api/scrapers/ai/assemble-script`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assemble script");
      }

      const data = await response.json();
      setScriptContent(data.assembledScript);

      // Refresh the page to show the new data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setAssembling(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // If we're editing, we need to update the script first
      if (isEditing) {
        const updateResponse = await fetch(`/api/scrapers/ai/update-script`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.id,
            script: scriptContent,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || "Failed to update script");
        }
      }

      // If we already have a scraper ID, we're done
      if (assemblyData.scraperId) {
        onComplete(assemblyData.scraperId);
        return;
      }

      // Otherwise, we need to create the scraper
      const response = await fetch(`/api/scrapers/ai/create-scraper`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create scraper");
      }

      const data = await response.json();
      onComplete(data.scraperId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Script Assembly</h2>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assembly Status */}
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Assembly Status</h3>
            <p className="text-sm text-gray-500">
              {assemblyData.assembledScript
                ? "Script has been assembled"
                : "Script has not been assembled yet"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                assemblyData.validationResult && assemblyData.validationResult.valid
                  ? "bg-green-100 text-green-800"
                  : assemblyData.validationResult
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {assemblyData.validationResult && assemblyData.validationResult.valid
                ? "Valid"
                : assemblyData.validationResult
                ? "Invalid"
                : "Not Validated"}
            </span>
          </div>
        </div>
      </div>

      {/* Validation Error */}
      {assemblyData.validationResult && !assemblyData.validationResult.valid && assemblyData.validationResult.error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{assemblyData.validationResult.error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Script Content */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Script Content</h3>
          {assemblyData.assembledScript && (
            <Button
              variant="outline"
              onClick={toggleEditing}
              className="text-xs px-2 py-1 h-auto"
            >
              {isEditing ? "Cancel Editing" : "Edit Script"}
            </Button>
          )}
        </div>

        {isEditing ? (
          <textarea
            value={scriptContent}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setScriptContent(e.target.value)}
            rows={20}
            className="font-mono text-xs block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <pre className="p-4 text-xs font-mono overflow-x-auto bg-gray-50 max-h-96">
              {scriptContent || "No script content available"}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Data Extraction
        </Button>

        <div className="flex space-x-3">
          {!assemblyData.assembledScript && (
            <Button
              variant="outline"
              onClick={handleAssemble}
              disabled={assembling}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${assembling ? 'animate-spin' : ''}`} />
              {assembling ? "Assembling..." : "Assemble Script"}
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={loading || !assemblyData.assembledScript || (assemblyData.validationResult && !assemblyData.validationResult.valid)}
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : assemblyData.scraperId ? "Complete" : "Create Scraper"}
          </Button>
        </div>
      </div>
    </div>
  );
}
