"use client";

import { useEffect, useContext, useState } from "react";
import { DirectoryContext } from "../DirectoryProvider";

export default function FileMetadata({ docId }: { docId: string }) {
  const dirCtx = useContext(DirectoryContext);
  if (!dirCtx) {
    throw new Error("Must be used within a DirectoryProvider");
  }

  const [name, setName] = useState<string>("");
  const [parentPath, setParentPath] = useState<string[]>([]);

  useEffect(() => {
    if (!dirCtx.dirMap.has(docId)) {
      dirCtx.dirMap.set(docId, {
        name: "Untitled Drawing",
        type: "tldraw",
        updated: Date.now(),
      });
    }
    const handleChanges = (changes: Map<string, any>) => {
      if (changes.has(docId) && dirCtx.dirMap.has(docId)) {
        const meta = dirCtx.dirMap.get(docId);
        setName(meta?.name || "");
        document.title = meta?.name || "TLDraw";

        const parents: string[] = [];
        let p = meta?.parent;

        while (p) {
          const v = dirCtx.dirMap.get(p);
          if (v) {
            parents.unshift(v.name);
            p = v.parent;
          } else {
            break;
          }
        }

        setParentPath(parents);
      }
    };
    const m = new Map();
    if (docId) {
      m.set(docId, {
        action: "add",
        newValue: dirCtx.dirMap.get(docId),
      });
    }
    handleChanges(m);

    dirCtx.dirMap.on("change", handleChanges);
    return () => {
      dirCtx.dirMap.off("change", handleChanges);
    };
  }, [dirCtx.dirMap, docId]);
  return (
    <>
      <div
        className="mb-2 text-left items-center text-neutral-500 border-2 border-yellow-200 rounded-lg bg-yellow-50 px-6 py-3"
        style={{ pointerEvents: "all", display: "flex" }}
      >
        <div>
          <p className="text-pink-950">
            /
            {parentPath.map((p, i) => (
              <span key={i}>{p}/</span>
            ))}
          </p>
          <h1 className="text-xl font-bold text-pink-950">
            <input
              className="text-pink-950 bg-yellow-50"
              type="text"
              value={name}
              placeholder="Untitled drawing"
              onChange={(evt) =>
                dirCtx.dirMap.set(docId, {
                  ...dirCtx.dirMap.get(docId),
                  name: evt.target.value,
                  type: "tldraw",
                  updated: Date.now(),
                })
              }
            />
            .tldraw
          </h1>
        </div>
      </div>
    </>
  );
}
