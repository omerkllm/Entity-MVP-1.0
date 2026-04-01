import 'dotenv/config';
import { query } from '../src/lib/db/client.js';

async function main() {
  // Warm-up query (first HTTP request has TLS overhead)
  await query('SELECT 1', []);
  console.log('--- Query Timings (after warm-up) ---');

  // Promise.all with 3 concurrent queries (the new warehousing-data pattern)
  const t0 = performance.now();
  const [wh, pr, ob] = await Promise.all([
    query(`SELECT
      w.warehouse_id AS "warehouseId", w.warehouse_id AS id, w.title, w.region,
      w.coordinates, w.object_category AS "objectCategory",
      w.operational_hours AS hours, w.status,
      w.total_capacity AS "totalCapacity",
      COALESCE(agg.total_qty, 0) AS "usedCapacity",
      COALESCE(agg.transit_qty, 0) AS "transitQty",
      w.business_link_type AS "businessLinkType",
      c.process_id AS "processId",
      w.title || ' { ' || w.warehouse_id || ' }' AS "warehouseName",
      '' AS address,
      COUNT(*) OVER() AS total
    FROM warehouse w
    JOIN category c ON w.category_id = c.category_id
    LEFT JOIN (
      SELECT warehouse_id,
             SUM(quantity)::int AS total_qty,
             SUM(CASE WHEN transit_status = 'In Transit' THEN quantity ELSE 0 END)::int AS transit_qty
      FROM object GROUP BY warehouse_id
    ) agg ON agg.warehouse_id = w.warehouse_id
    ORDER BY w.warehouse_id LIMIT 200 OFFSET 0`, []),
    query(`SELECT p.*, COUNT(*) OVER() AS total FROM processes p ORDER BY p.process_id LIMIT 200 OFFSET 0`, []),
    query(`SELECT object_id AS "objectId", object_category AS "objectCategory",
           quantity, unit,
           to_char(arrival_time, 'YYYY-MM-DD HH24:MI') AS "arrivalTime",
           transit_status AS "transitStatus", object_health AS "objectHealth",
           warehouse_id AS "warehouseId",
           COUNT(*) OVER() AS total
    FROM object ORDER BY object_id LIMIT 500 OFFSET 0`, []),
  ]);
  const t1 = performance.now();
  console.log(`Promise.all(wh + pr + obj): ${(t1 - t0).toFixed(0)}ms  [3 concurrent HTTP requests, ${wh.rows.length} wh + ${pr.rows.length} pr + ${ob.rows.length} obj]`);
}

main();
