"use client";

import { useContext, useState, useMemo, useEffect } from "react";
import { DirectoryContext } from "../DirectoryProvider";
import { nanoid } from "nanoid";
import type { DirectoryEntry } from "../DirectoryProvider";
import FileList, { FolderEnt, FolderHref } from "./FileList";
import {
  VscNewFile,
  VscNewFolder,
  VscCircleLarge,
  VscCircleLargeFilled,
} from "react-icons/vsc";
import invariant from "tiny-invariant";
import { SearchBox } from "./Search";
import { useRouter } from "next/navigation";

type BrowseProps = {
  searchParams: Record<string, string>;
  params: {
    folderName?: string[];
  };
};

export default function Browse({ params }: BrowseProps) {
  const router = useRouter();
  const dirCtx = useContext(DirectoryContext);
  const docId =
    params.folderName !== undefined && params.folderName.length > 0
      ? params.folderName[params.folderName.length - 1]
      : undefined;
  if (dirCtx === null) {
    throw new Error("Browse must be used within a DirectoryProvider");
  }

  const [update, mk, del] = useMemo(() => {
    return [
      (id: string, v: DirectoryEntry) => {
        if (v.type === "tldraw") {
          v.updated = Date.now();
        }
        dirCtx.dirMap.set(id, v);
      },
      (v: DirectoryEntry) => {
        if (v.type === "tldraw") {
          v.updated = Date.now();
        }
        dirCtx.dirMap.set(nanoid(), v);
      },
      (k: string) => {
        const existing = dirCtx.dirMap.get(k);
        if (existing) {
          if (existing.type === "tldraw") {
            dirCtx.dirMap.set(k, {
              ...existing,
              deleted: !existing.deleted,
              updated: Date.now(),
            });
          } else {
            dirCtx.dirMap.set(k, { ...existing, deleted: !existing.deleted });
          }
        }
      },
    ];
  }, [dirCtx.dirMap]);

  const [children, setChildren] = useState<
    Map<string | undefined, FolderEnt[]>
  >(new Map());
  const [metadata, setMetadata] = useState<FolderEnt | undefined>(undefined);
  const [allMetadata, setAllMetadata] = useState<FolderEnt[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [searchQueryResults, setSearchQueryResults] = useState<
    FolderEnt[] | undefined
  >(undefined);
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    const handleChanges = (changes: Map<string, any>) => {
      const p: Map<string | undefined, string[]> = new Map();

      const getParentPath = (id: string | undefined): string[] => {
        const e = p.get(id);
        if (e !== undefined) {
          return e;
        }
        if (id === undefined) {
          return [];
        }
        const m = dirCtx.dirMap.get(id);
        invariant(m);
        const n = [...getParentPath(m.parent), m.name];
        p.set(id, n);
        return n;
      };

      const a = [];
      const cmap: Map<string | undefined, FolderEnt[]> = new Map();
      for (const [objId, objMeta] of dirCtx.dirMap) {
        if (!cmap.has(objMeta.parent)) {
          cmap.set(objMeta.parent, []);
        }

        // walk the parent paths
        const parentPath = getParentPath(objMeta.parent);

        cmap.get(objMeta.parent)?.push({ ...objMeta, ref: objId, parentPath });
        a.push({ ...objMeta, ref: objId, parentPath });
      }
      cmap.forEach((c, _) => {
        c.sort((a, b) => {
          const funcs = [
            (f: FolderEnt) => !f.deleted,
            (f: FolderEnt) => f.type === "dir",
            (f: FolderEnt) => (f.type === "tldraw" ? f.updated : 0),
            (f: FolderEnt) => f.name,
          ];

          for (const func of funcs) {
            const aa = func(a);
            const bb = func(b);
            if (aa < bb) {
              return 1;
            } else if (aa > bb) {
              return -1;
            }
          }
          return 0;
        });
      });
      setChildren(cmap);
      setAllMetadata(a);

      if (docId && changes.has(docId)) {
        const meta = dirCtx.dirMap.get(docId);

        if (meta?.type === "tldraw") {
          // navigate to tldraw page instead
          router.push(`/editor?doc=${docId}`);
        }

        if (meta !== undefined) {
          setMetadata({ ...meta, ref: docId, parentPath: p.get(docId) });
        }
        document.title = meta?.name || "TLDraw";
      }
    };
    const m = new Map();
    for (const [objId, objMeta] of dirCtx.dirMap) {
      m.set(objId, {
        action: "add",
        newValue: objMeta,
      });
    }
    handleChanges(m);

    dirCtx.dirMap.on("change", handleChanges);

    return () => {
      dirCtx.dirMap.off("change", handleChanges);
    };
  }, [dirCtx.dirMap, docId, router]);

  const contents: FolderEnt[] = useMemo(() => {
    const r: FolderEnt[] = [];
    if (searchQueryResults === undefined) {
      if (docId !== undefined) {
        r.push({
          name: ".. (up one level)",
          type: "dir",
          ref: metadata?.parent,
        });
      }
      const cc = children.get(docId);
      if (cc) {
        r.push(...cc.map((c) => ({ ...c, editable: true })));
      }
    } else {
      r.push(...searchQueryResults);
    }
    return r.map((rr, idx) => ({ ...rr, selected: idx === selectedIndex }));
  }, [children, docId, metadata?.parent, searchQueryResults, selectedIndex]);

  useEffect(() => {
    if (selectedIndex && selectedIndex > contents.length - 1) {
      if (contents.length - 1 > 0) {
        setSelectedIndex(contents.length - 1);
      } else {
        setSelectedIndex(undefined);
      }
    }
  }, [contents, selectedIndex]);

  return (
    <>
      <div
        className="h-full w-full absolute"
        onKeyDown={(evt) => {
          if (evt.key === "ArrowDown") {
            evt.stopPropagation();
            if (selectedIndex === undefined) {
              setSelectedIndex(0);
            } else if (selectedIndex < contents.length - 1) {
              setSelectedIndex(selectedIndex + 1);
            }
          } else if (evt.key === "ArrowUp") {
            evt.stopPropagation();
            if (selectedIndex === undefined && contents.length > 0) {
              setSelectedIndex(contents.length - 1);
            } else if (selectedIndex && selectedIndex > 0) {
              setSelectedIndex(selectedIndex - 1);
            }
          } else if (evt.key === "Enter") {
            evt.stopPropagation();
            if (selectedIndex !== undefined) {
              router.push(FolderHref(contents[selectedIndex]));
            }
          } else if (evt.key === "Escape") {
            evt.stopPropagation();
            setSelectedIndex(undefined);
          }
        }}
      >
        <h1 className="mb-2 text-left items-center text-neutral-500 border-2 border-yellow-200 bg-yellow-50 px-6 py-3">
          <span>/</span>
          {(metadata?.parentPath || []).map((segment, idx) => (
            <div key={`${segment}-${idx}`} className="inline">
              <span>{segment}</span>
              <span>/</span>
            </div>
          ))}
          {docId && (
            <input
              type="text"
              value={metadata?.name || ""}
              onChange={(evt) => {
                if (metadata && docId) {
                  update(docId, { ...metadata, name: evt.target.value });
                }
              }}
            />
          )}
        </h1>
        <SearchBox
          items={allMetadata}
          autoFocus
          setSearchResults={setSearchQueryResults}
        />
        <div className="min-w-1/2 px-3 py-3">
          <FileList
            showHidden={showHidden && searchQueryResults === undefined}
            showFullPath={searchQueryResults !== undefined}
            items={contents}
            mv={(id, parent, name) => {
              if (dirCtx.dirMap.has(id)) {
                update(id, { ...dirCtx.dirMap.get(id)!, parent, name });
              }
            }}
            del={del}
          />
        </div>
        <hr />
        {searchQueryResults === undefined && (
          <>
            <div className="min-w-1/2 px-3 py-3">
              <button
                onClick={(evt) => {
                  evt.preventDefault();
                  mk({ name: "New folder", type: "dir", parent: docId });
                }}
                className="btn"
              >
                <VscNewFolder fontSize={16} />
              </button>
              <button
                onClick={(evt) => {
                  evt.preventDefault();
                  mk({
                    name: "Untitled drawing",
                    type: "tldraw",
                    parent: docId,
                    updated: Date.now(),
                  });
                }}
                className="btn"
              >
                <VscNewFile fontSize={16} />
              </button>
              <button
                onClick={(evt) => {
                  evt.preventDefault();
                  setShowHidden(!showHidden);
                }}
                className="btn"
              >
                {showHidden ? (
                  <VscCircleLargeFilled fontSize={16} />
                ) : (
                  <VscCircleLarge fontSize={16} />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
