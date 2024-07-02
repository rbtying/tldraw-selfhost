import { FolderEnt, FolderHref } from "./FileList";
import { useState, useEffect } from "react";
import fuzzysort from "fuzzysort";
import { useRouter } from "next/navigation";

type SearchParams = {
  items: FolderEnt[];
  setSearchResults: (items: FolderEnt[] | undefined) => void;
  autoFocus?: boolean;
};

export function SearchBox({
  items,
  setSearchResults,
  autoFocus,
}: SearchParams) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (searchQuery) {
      const results = fuzzysort.go(
        searchQuery,
        items.filter((f) => !f.deleted),
        {
          limit: 20,
          keys: ["name", "parentPath", "type"],
        }
      );
      setSearchResults(results.map((r) => r.obj));
    } else {
      setSearchResults(undefined);
    }
  }, [items, searchQuery, setSearchResults]);

  return (
    <div className="mb-2 text-left items-center text-neutral-500 w-full relative">
      <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
          />
        </svg>
      </div>
      <input
        type="text"
        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder="Search..."
        value={searchQuery}
        onChange={(evt) => {
          setSearchQuery(evt.target.value);
        }}
        autoFocus={autoFocus}
      />
    </div>
  );
}
