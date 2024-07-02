"use client";

import { YSweetProvider, createYjsProvider } from "@y-sweet/react";
import { ClientToken } from "@y-sweet/sdk";
import type { ReactNode } from "react";
import { LWWMap } from "../y-lwwmap";
import { createContext, useEffect, useState } from "react";
import * as Y from "yjs";

export type DirectoryEntry =
  | {
      parent?: string;
      name: string;
      type: "dir";
      deleted?: boolean;
    }
  | {
      parent?: string;
      name: string;
      type: "tldraw";
      deleted?: boolean;
      updated: number;
    };

export type DirectoryContextType = {
  dirMetadata: Y.Doc;
  provider: YSweetProvider;
  clientToken: ClientToken;
  dirMap: LWWMap<DirectoryEntry>;
};
export const DirectoryContext = createContext<DirectoryContextType | null>(
  null
);

export function DirectoryProvider({
  directoryClientToken,
  children,
}: {
  directoryClientToken: ClientToken;
  children: ReactNode;
}) {
  const [ctx, setCtx] = useState<DirectoryContextType | null>(null);

  useEffect(() => {
    const dirMetadata = new Y.Doc();
    const provider = createYjsProvider(dirMetadata, directoryClientToken);
    const dirMap = new LWWMap(
      dirMetadata.getArray<{ key: string; val: DirectoryEntry }>("dirents")
    );

    setCtx({
      dirMetadata,
      provider,
      clientToken: directoryClientToken,
      dirMap,
    });

    return () => {
      dirMetadata.destroy();
      provider.destroy();
    };
  }, [
    directoryClientToken,
    directoryClientToken.token,
    directoryClientToken.url,
    directoryClientToken.docId,
  ]);

  if (!ctx) return null;

  return (
    <DirectoryContext.Provider value={ctx}>
      {children}
    </DirectoryContext.Provider>
  );
}
