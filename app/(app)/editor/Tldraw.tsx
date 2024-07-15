"use client";

import {
  InstancePresenceRecordType,
  TLInstancePresence,
  TLUiOverrides,
  TLRecord,
  TLStore,
  TLStoreWithStatus,
  computed,
  createPresenceStateDerivation,
  createTLStore,
  defaultUserPreferences,
  Editor,
  getUserPreferences,
  setUserPreferences,
  react,
  SerializedSchema,
  track,
  useEditor,
  Tldraw,
  HistoryEntry,
  throttle,
  TLUiActionsContextType,
} from "tldraw";
import "tldraw/tldraw.css";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useContext,
} from "react";
import { YKeyValue } from "y-utility/y-keyvalue";
import { useMap, useArray, useYDoc, useYjsProvider } from "@y-sweet/react";
import FileMetadata from "./FileMetadata";
import { DirectoryContext } from "../DirectoryProvider";
import * as Y from "yjs";
import invariant from "tiny-invariant";

const overrides: TLUiOverrides = {
  actions(_editor, actions): TLUiActionsContextType {
    return {
      ...actions,
      "toggle-grid": { ...actions["toggle-grid"], kbd: "x" },
      "copy-as-png": { ...actions["copy-as-png"], kbd: "$1" },
    };
  },
};

export default function TldrawWrapper({ docId }: { docId: string }) {
  const [store] = useState<TLStore>(createTLStore());
  const editor = useRef<Editor | null>(null);
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  const dirCtx = useContext(DirectoryContext);
  const yDoc = useYDoc();
  const room = useYjsProvider();
  const meta = useMap<SerializedSchema>("meta");
  const yArr = useArray<{ key: string; val: TLRecord }>(`tl_room`);

  const [yStore] = useMemo(() => {
    const yStore = new YKeyValue(yArr);

    return [yStore];
  }, [yArr]);

  useLayoutEffect(() => {
    const unsubs: (() => void)[] = [];
    const syncUnsubs: (() => void)[] = [];

    const pendingChanges: HistoryEntry<TLRecord>[] = [];

    const dispatchUpdates = throttle(() => {
      if (pendingChanges.length > 0) {
        const m = dirCtx?.dirMap.get(docId);
        invariant(m);
        invariant(m.type === "tldraw");
        dirCtx?.dirMap.set(docId, { ...m, updated: Date.now() });
      }
      yDoc.transact(() => {
        pendingChanges.forEach(({ changes }) => {
          Object.values(changes.added).forEach((record) => {
            yStore.set(record.id, record);
          });

          Object.values(changes.updated).forEach(([_, record]) => {
            yStore.set(record.id, record);
          });

          Object.values(changes.removed).forEach((record) => {
            yStore.delete(record.id);
          });
        });
        pendingChanges.length = 0;
      });
    }, 32);

    function handleSync() {
      syncUnsubs.forEach((fn) => fn());
      syncUnsubs.length = 0;

      // 1.
      // Connect store to yjs store and vis versa, for both the document and awareness

      /* -------------------- Document -------------------- */

      // Sync store changes to the yjs doc
      syncUnsubs.push(
        store.listen(
          function syncStoreChangesToYjsDoc(evt) {
            pendingChanges.push(evt);
            dispatchUpdates();
          },
          { source: "user", scope: "document" } // only sync user's document changes
        )
      );

      // Sync the yjs doc changes to the store
      const handleChange = (
        changes: Map<
          string,
          | { action: "delete"; oldValue: TLRecord }
          | { action: "update"; oldValue: TLRecord; newValue: TLRecord }
          | { action: "add"; newValue: TLRecord }
        >,
        transaction: Y.Transaction
      ) => {
        if (transaction.local) return;

        const toRemove: TLRecord["id"][] = [];
        const toPut: TLRecord[] = [];

        changes.forEach((change, id) => {
          switch (change.action) {
            case "add":
            case "update": {
              const record = yStore.get(id)!;
              toPut.push(record);
              break;
            }
            case "delete": {
              toRemove.push(id as TLRecord["id"]);
              break;
            }
          }
        });

        // put / remove the records in the store
        store.mergeRemoteChanges(() => {
          if (toRemove.length) store.remove(toRemove);
          if (toPut.length) store.put(toPut);
        });
      };

      yStore.on("change", handleChange);
      syncUnsubs.push(() => yStore.off("change", handleChange));

      /* -------------------- Awareness ------------------- */

      const yClientId = room.awareness.clientID.toString();
      setUserPreferences({ id: yClientId });

      const userPreferences = computed<{
        id: string;
        color: string;
        name: string;
      }>("userPreferences", () => {
        const user = getUserPreferences();
        return {
          id: user.id,
          color: user.color ?? defaultUserPreferences.color,
          name: user.name ?? defaultUserPreferences.name,
        };
      });

      // Create the instance presence derivation
      const presenceId = InstancePresenceRecordType.createId(yClientId);
      const presenceDerivation = createPresenceStateDerivation(
        userPreferences,
        presenceId
      )(store);

      // Set our initial presence from the derivation's current value
      room.awareness.setLocalStateField("presence", presenceDerivation.get());

      // When the derivation change, sync presence to to yjs awareness
      syncUnsubs.push(
        react("when presence changes", () => {
          const presence = presenceDerivation.get();
          requestAnimationFrame(() => {
            room.awareness.setLocalStateField("presence", presence);
          });
        })
      );

      // Sync yjs awareness changes to the store
      const handleUpdate = (update: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const states = room.awareness.getStates() as Map<
          number,
          { presence: TLInstancePresence }
        >;

        const toRemove: TLInstancePresence["id"][] = [];
        const toPut: TLInstancePresence[] = [];

        // Connect records to put / remove
        for (const clientId of update.added) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            toPut.push(state.presence);
          }
        }

        for (const clientId of update.updated) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            toPut.push(state.presence);
          }
        }

        for (const clientId of update.removed) {
          toRemove.push(
            InstancePresenceRecordType.createId(clientId.toString())
          );
        }

        // put / remove the records in the store
        store.mergeRemoteChanges(() => {
          if (toRemove.length) store.remove(toRemove);
          if (toPut.length) store.put(toPut);
        });
      };
      room.awareness.on("update", handleUpdate);
      syncUnsubs.push(() => room.awareness.off("update", handleUpdate));

      const handleMetaUpdate = () => {
        const theirSchema = meta.get("schema");
        if (!theirSchema) {
          throw new Error("No schema found in the yjs doc");
        }
        // If the shared schema is newer than our schema, the user must refresh
        const newMigrations = store.schema.getMigrationsSince(theirSchema);

        if (!newMigrations.ok || newMigrations.value.length > 0) {
          window.alert("The schema has been updated. Please refresh the page.");
          yDoc.destroy();
        }
      };
      meta.observe(handleMetaUpdate);
      syncUnsubs.push(() => meta.unobserve(handleMetaUpdate));

      // 2.
      // Initialize the store with the yjs doc records—or, if the yjs doc
      // is empty, initialize the yjs doc with the default store records.
      if (yStore.yarray.length) {
        // Replace the store records with the yjs doc records
        const ourSchema = store.schema.serialize();
        const theirSchema = meta.get("schema");
        if (!theirSchema) {
          throw new Error("No schema found in the yjs doc");
        }

        const records = yStore.yarray.toJSON().map(({ val }) => val);

        const migrationResult = store.schema.migrateStoreSnapshot({
          schema: theirSchema,
          store: Object.fromEntries(
            records.map((record) => [record.id, record])
          ),
        });
        if (migrationResult.type === "error") {
          // if the schema is newer than ours, the user must refresh
          console.error(migrationResult.reason);
          window.alert("The schema has been updated. Please refresh the page.");
          return;
        }

        yDoc.transact(() => {
          // delete any deleted records from the yjs doc
          for (const r of records) {
            if (!migrationResult.value[r.id]) {
              yStore.delete(r.id);
            }
          }
          for (const r of Object.values(migrationResult.value) as TLRecord[]) {
            yStore.set(r.id, r);
          }
          meta.set("schema", ourSchema);
        });

        store.loadStoreSnapshot({
          store: migrationResult.value,
          schema: ourSchema,
        });
      } else {
        // Create the initial store records
        // Sync the store records to the yjs doc
        yDoc.transact(() => {
          for (const record of store.allRecords()) {
            yStore.set(record.id, record);
          }
          meta.set("schema", store.schema.serialize());
        });
      }
    }

    handleSync();

    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
      syncUnsubs.forEach((fn) => fn());
      syncUnsubs.length = 0;
    };
  }, [room, yDoc, yArr, yStore, meta, store, dirCtx, docId]);

  useEffect(() => {
    function handleStatusChange({
      status,
    }: {
      status: "disconnected" | "connected" | "connecting";
    }) {
      // If we're disconnected, set the store status to 'synced-remote' and the connection status to 'offline'
      if (status === "disconnected" || status === "connecting") {
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "offline",
        });
        editor?.current?.updateInstanceState({ isReadonly: true });
        return;
      }

      if (status === "connected") {
        setStoreWithStatus({
          store,
          status: "synced-remote",
          connectionStatus: "online",
        });
        editor?.current?.updateInstanceState({ isReadonly: false });
      }
    }

    room.on("status", handleStatusChange);
    return () => room.off("status", handleStatusChange);
  }, [editor, room, store]);
  const dirMeta = <FileMetadata docId={docId} />;

  return (
    <>
      <div className="tldraw__editor h-full my-1 sm:mr-2 sm:rounded-lg overflow-hidden bg-white">
        <Tldraw
          autoFocus
          overrides={overrides}
          onMount={(e) => {
            editor.current = e;
          }}
          store={storeWithStatus}
          components={{
            SharePanel: NameEditor,
            TopPanel: track(() => dirMeta),
          }}
        />
      </div>
    </>
  );
}

const TopPanel = track(() => {
  const room = useYjsProvider();
  const [status, setStatus] = useState("connected");
  useEffect(() => {
    function handleStatusChange({
      status,
    }: {
      status: "disconnected" | "connected" | "connecting";
    }) {
      setStatus(status);
    }
    room.on("status", handleStatusChange);
    return () => room.off("status", handleStatusChange);
  }, [room]);

  return (
    <>
      <p>{status}</p>
    </>
  );
});

const NameEditor = track(() => {
  const editor = useEditor();

  const { color, name } = editor.user.getUserPreferences();

  return (
    <div style={{ pointerEvents: "all", display: "flex" }}>
      <input
        type="color"
        value={color}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            color: e.currentTarget.value,
          });
        }}
      />
      <input
        value={name}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            name: e.currentTarget.value,
          });
        }}
      />
    </div>
  );
});
