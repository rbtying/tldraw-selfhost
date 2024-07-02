"use client";

import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useRouter } from "next/navigation";
import type { DirectoryEntry } from "../DirectoryProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { FcFile, FcFolder } from "react-icons/fc";
import {
  MdDriveFileRenameOutline,
  MdDeleteOutline,
  MdDeleteForever,
} from "react-icons/md";

export type FolderEnt = DirectoryEntry & {
  ref?: string;
  parentPath?: string[];
  selected?: boolean;
  editable?: boolean;
};

export function FolderHref({ ref, type }: FolderEnt) {
  if (ref === undefined) {
    return "/";
  } else if (type === "tldraw") {
    return `/editor?doc=${ref}`;
  } else {
    return `/${ref}`;
  }
}

type FileListProps = {
  items: FolderEnt[];
  showHidden: boolean;
  showFullPath?: boolean;
  mv?: (id: string, parent: string | undefined, name: string) => void;
  del?: (id: string) => void;
};

export default function FileList({
  items,
  mv,
  del,
  showHidden,
  showFullPath,
}: FileListProps) {
  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) {
          return;
        }
        const destFile = destination.data.file as FolderEnt;
        const srcFile = source.data.file as FolderEnt;
        if (mv && srcFile.ref && destFile.ref && srcFile.ref !== destFile.ref) {
          mv(srcFile.ref, destFile.ref, srcFile.name);
        }
      },
    });
  }, [mv]);

  const files = useMemo(() => {
    return items.filter((c) => !c.deleted || showHidden);
  }, [items, showHidden]);

  return (
    <div>
      <div className="relative flex flex-col text-gray-700 bg-white rounded-xl bg-clip-border">
        <div className="flex min-w-[240px] flex-col gap-1 p-2 font-sans text-base font-normal text-blue-gray-700">
          {files.length > 0 ? (
            files.map((child) => (
              <FileEntry
                showFullPath={showFullPath}
                key={child.ref || "root"}
                file={child}
                onNameChange={(name) => {
                  if (child.ref && mv) {
                    mv(child.ref, child.parent, name);
                  }
                }}
                name={child.name}
                del={() => {
                  if (child.ref && del) {
                    del(child.ref);
                  }
                }}
              />
            ))
          ) : (
            <span className="text-gray-400">(empty)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FileEntry({
  name,
  file,
  showFullPath,
  onNameChange,
  del,
}: {
  name: string;
  file: FolderEnt;
  showFullPath?: boolean;
  onNameChange?: (name: string) => void;
  del: () => void;
}) {
  const router = useRouter();
  const ref = useRef(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    invariant(el);
    const unsubs: (() => void)[] = [];

    if (file.type === "dir") {
      unsubs.push(
        dropTargetForElements({
          element: el,
          onDragEnter: () => setIsDraggedOver(true),
          onDragLeave: () => setIsDraggedOver(false),
          onDrop: () => setIsDraggedOver(false),
          getData: () => ({ file }),
        })
      );
    }

    if (file.editable) {
      unsubs.push(
        draggable({
          element: el,
          getInitialData: () => ({ file }),
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false),
        })
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
    };
  }, [file]);

  return (
    <div ref={ref}>
      <div
        className={`flex py-1 items-center justify-between ${
          file.selected ? "bg-slate-50" : ""
        }`}
      >
        <div
          className="flex flex-1 items-center space-x-2 cursor-pointer"
          onClick={(evt) => {
            const modifier =
              evt.getModifierState("Meta") || evt.getModifierState("Control");
            if (modifier) {
              window.open(FolderHref(file), "_blank");
            } else {
              router.push(FolderHref(file));
            }
          }}
        >
          {file.type === "dir" ? (
            <FcFolder fontSize={22} />
          ) : (
            <FcFile fontSize={22} />
          )}
          <p
            className={`flex-1 ${
              file.deleted ? "text-gray-400" : "text-black-400"
            }`}
          >
            {isEditing && (
              <>
                <input
                  type="text"
                  value={name}
                  onChange={(evt) =>
                    onNameChange && onNameChange(evt.target.value)
                  }
                  onBlur={() => setIsEditing(false)}
                  autoFocus
                />
                {file.type === "dir" ? "" : ".tldraw"}
              </>
            )}
            {!isEditing && (
              <span
                className="hover:text-blue-400"
                onClick={(evt) => {
                  if (file.editable) {
                    evt.stopPropagation();
                    setIsEditing(true);
                  }
                }}
              >
                <span className="text-gray-400">
                  {showFullPath &&
                    ["", ...(file.parentPath || [])].join("/") + "/"}
                </span>
                {name}
                {file.type === "dir" ? "" : ".tldraw"}
              </span>
            )}
            <span>
              {isDraggedOver ? " (drop here)" : ""}
              {dragging ? " (dragging...)" : ""}
            </span>
            {file.editable && (
              <span className="float-right hover:text-blue-400">
                <button
                  onClick={(evt) => {
                    evt.stopPropagation();
                    del();
                  }}
                >
                  {file.deleted ? (
                    <MdDeleteForever fontSize={22} />
                  ) : (
                    <MdDeleteOutline fontSize={22} />
                  )}
                </button>
              </span>
            )}
            {file.editable && (
              <span className="float-right hover:text-blue-400">
                <button
                  onClick={(evt) => {
                    evt.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  <MdDriveFileRenameOutline fontSize={22} />
                </button>
              </span>
            )}
            {file.type === "tldraw" && (
              <span className="float-right text-gray-400">
                {new Date(file.updated).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
