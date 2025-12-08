/**
 * Generic CRUD route factory
 * 
 * Creates standardized REST API routes for database collections
 * to eliminate code duplication across different resources.
 */

/**
 * Create standard CRUD routes for a resource
 * 
 * @param {Object} app - Express application instance
 * @param {string} resourceName - Name of the resource (e.g., 'modules', 'tasks')
 * @param {Object} db - Database interface with getAll, create, update, delete methods
 * @param {Object} options - Optional configuration
 * @param {boolean} options.hasUpdate - Whether to include PUT route (default: false)
 */
export function createCrudRoutes(app, resourceName, db, options = {}) {
  const { hasUpdate = false } = options;
  const basePath = `/api/${resourceName}`;
  const logPrefix = `[${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}]`;

  // GET /api/{resource} - List all
  app.get(basePath, (req, res) => {
    try {
      const items = db.getAll();
      res.json(items);
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/{resource} - Create new
  app.post(basePath, (req, res) => {
    try {
      const item = db.create(req.body);
      res.json(item);
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/{resource}/:id - Update existing (optional)
  if (hasUpdate) {
    app.put(`${basePath}/:id`, (req, res) => {
      try {
        const item = db.update(req.params.id, req.body);
        res.json(item);
      } catch (error) {
        console.error(`${logPrefix} Error:`, error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  // DELETE /api/{resource}/:id - Delete
  app.delete(`${basePath}/:id`, (req, res) => {
    try {
      db.delete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(`${logPrefix} Error:`, error);
      res.status(500).json({ error: error.message });
    }
  });
}
