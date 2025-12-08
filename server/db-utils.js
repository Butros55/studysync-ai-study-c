/**
 * Generic database collection manager
 * 
 * Provides reusable CRUD operations for JSON file-based collections
 * to eliminate code duplication across different data types.
 */

import fs from "fs";

/**
 * Create a generic database collection interface
 * 
 * @param {string} collection - Name of the collection (e.g., 'modules', 'tasks')
 * @param {Object} options - Configuration options
 * @param {Function} options.sortFn - Optional sort function for getAll results
 * @param {Function} options.getFilePath - Function to get file path for collection
 * @param {Function} options.readCollection - Function to read collection data
 * @param {Function} options.writeCollection - Function to write collection data
 */
export function createCollectionDB(
  collection,
  { sortFn, getFilePath, readCollection, writeCollection }
) {
  return {
    getAll: () => {
      const items = readCollection(collection);
      return sortFn ? items.sort(sortFn) : items;
    },

    getById: (id) => {
      const items = readCollection(collection);
      return items.find((item) => item.id === id) || null;
    },

    getByModuleId: (moduleId) => {
      const items = readCollection(collection);
      return items.filter((item) => item.moduleId === moduleId);
    },

    create: (data) => {
      const items = readCollection(collection);
      items.push(data);
      writeCollection(collection, items);
      return data;
    },

    update: (id, data) => {
      const items = readCollection(collection);
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        writeCollection(collection, items);
        return items[index];
      }
      return null;
    },

    delete: (id) => {
      let items = readCollection(collection);
      items = items.filter((item) => item.id !== id);
      writeCollection(collection, items);
      return { success: true };
    },
  };
}

/**
 * Sort by date descending (most recent first)
 */
export function sortByDateDesc(dateField = "createdAt") {
  return (a, b) =>
    new Date(b[dateField]).getTime() - new Date(a[dateField]).getTime();
}
