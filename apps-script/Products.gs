/**
 * Products.gs — product catalog.
 *   - listProductNames: names only (no prices) — needed to author a subscription, so it is
 *     gated on subscription create/update, NOT on products:read. This keeps prices hidden
 *     from reps while still letting them pick a product.
 *   - listProducts / CRUD: the full catalog WITH prices — gated on the products:* grants.
 */

function listProductNames_(payload, user) {
  // The product picker is only needed when authoring a subscription.
  if (!hasPermission_(user, 'subscriptions', 'create') && !hasPermission_(user, 'subscriptions', 'update')) {
    requirePermission_(user, 'subscriptions', 'create'); // throw a clear permission error
  }
  return readObjects(CONFIG.SHEETS.PRODUCTS)
    .filter(function (p) { return isTrue_(p.active); })
    .map(function (p) { return p.product_name; }); // names only, no prices
}

function listProducts_(payload, user) {
  requirePermission_(user, 'products', 'read');
  return readObjects(CONFIG.SHEETS.PRODUCTS);
}

function upsertProduct_(payload, user) {
  if (!payload.product_name) throw new Error('product_name is required');
  // Gate create vs update on the matching action so granular product perms are honored.
  var alreadyExists = readObjects(CONFIG.SHEETS.PRODUCTS).some(function (p) { return p.product_name === payload.product_name; });
  requirePermission_(user, 'products', alreadyExists ? 'update' : 'create');
  return withLock_(function () {
    var existing = readObjects(CONFIG.SHEETS.PRODUCTS).filter(function (p) { return p.product_name === payload.product_name; })[0];
    var row = {
      product_name: payload.product_name,
      price_per_week: payload.price_per_week !== undefined ? Number(payload.price_per_week) : (existing ? Number(existing.price_per_week) : 0),
      num_days: payload.num_days !== undefined ? Number(payload.num_days) : (existing ? Number(existing.num_days) : 7),
      active: payload.active !== undefined ? !!payload.active : (existing ? isTrue_(existing.active) : true),
    };
    if (existing) updateByKey(CONFIG.SHEETS.PRODUCTS, 'product_name', row.product_name, row);
    else appendObject(CONFIG.SHEETS.PRODUCTS, row);
    logAction_(user, existing ? 'Updated Product' : 'Created Product', row.product_name, 'PRODUCT', { after: row });
    return row;
  });
}

function deleteProduct_(payload, user) {
  // Soft delete = deactivate, to protect subscriptions that reference it.
  requirePermission_(user, 'products', 'delete');
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.PRODUCTS, 'product_name', payload.product_name, { active: false });
  });
  if (!merged) throw new Error('Product not found');
  logAction_(user, 'Deactivated Product', payload.product_name, 'PRODUCT', {});
  return merged;
}

function priceFor_(productName) {
  var row = readObjects(CONFIG.SHEETS.PRODUCTS).filter(function (p) { return p.product_name === productName; })[0];
  return row ? Number(row.price_per_week) : 0;
}
