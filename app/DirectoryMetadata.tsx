"use client";

import { useMap } from "@y-sweet/react";
import { useEffect } from "react";

export default function DirectoryMetadata({ docId }: { docId: string }) {
  const metadata = useMap<string>(docId);

  useEffect(() => {
    return metadata.observe(() => {
      document.title = metadata.get("name") || "Untitled drawing";
    });
  }, [metadata]);

  return (
    <>
      <div className="mb-2 text-left items-center text-neutral-500 border-2 border-yellow-200 rounded-lg bg-yellow-50 px-6 py-3">
        <div className="flex justify-between items-center pb-1">
          <h1 className="text-xl font-bold text-pink-950">
            <input
              className="text-pink-950 bg-yellow-50"
              type="text"
              value={metadata.get("name") || ""}
              placeholder="Untitled drawing"
              onChange={(evt) => metadata.set("name", evt.target.value)}
            />
          </h1>
          <div className="flex">
            <button
              className="text-sm flex items-center gap-1 px-3 py-1 rounded-lg bg-pink-950 text-white border transition-all "
              onClick={() => window.open(window.location.href, "_blank")}
            >
              Open link in a new tab
            </button>
          </div>
        </div>
        <div className="pr-2 w-full md:w-3/4">
          To simulate collaborating on this document, open this page in a new
          window. When you make edits in one window, you should see the document
          updated in the other.
        </div>
      </div>
    </>
  );
}
