-- DropX submission queries adapted from queries.sql.
-- Runtime placeholders have been replaced with reproducible sample values.

-- Query 1 | Other (constraint inspection)
SHOW CREATE TABLE pricing_slabs;

-- Query 2 | INSERT
INSERT INTO rider_applications
    (name, phone, email, district, vehicle_type, license_number,
     experience_years, availability, notes)
VALUES
    ('Imran Kabir', '01600000001', 'imran.rider@example.com',
     'Dhaka', 'MOTORCYCLE', 'DL-DHK-20002', 2.5,
     'Full-time', 'Available for morning and evening shifts');

-- Query 3 | UPDATE
UPDATE customers
SET status = 'ACTIVE',
    activated_at = CURRENT_TIMESTAMP
WHERE id = 4
  AND status = 'TEMP';

-- Query 4 | DELETE
DELETE FROM parcel_drafts
WHERE customer_id = 1;

-- Query 5 | SELECT-Filter
SELECT id, name, phone, email, status
FROM customers
WHERE phone = '01900000001'
   OR email = 'ayesha@example.com'
LIMIT 1;

-- Query 6 | ORDER BY
SELECT e.event_type, e.description, e.created_at,
       h.name AS hub_name
FROM parcel_events AS e
LEFT JOIN hubs AS h ON h.id = e.hub_id
WHERE e.parcel_id = 1
ORDER BY e.created_at DESC, e.id DESC
LIMIT 100;

-- Query 7 | LIKE
SELECT c.code, c.name, c.phone, c.email, c.status
FROM customers AS c
WHERE c.name LIKE '%Rahman%'
ORDER BY c.name ASC;

-- Query 8 | IN-BETWEEN
SELECT p.tracking_number, p.receiver_name, p.status,
       p.delivery_fee, p.created_at
FROM parcels AS p
WHERE p.status IN ('CREATED', 'AT_HUB', 'OUT_FOR_DELIVERY')
  AND p.created_at BETWEEN '2026-10-10 00:00:00'
                       AND '2026-10-14 23:59:59'
ORDER BY p.created_at DESC;

-- Query 9 | TOP-LIMIT
SELECT id, name, phone, district, vehicle_type, status, created_at
FROM rider_applications
ORDER BY created_at DESC, id DESC
LIMIT 5;

-- Query 10 | JOIN
SELECT p.tracking_number, p.parcel_type, p.payment_type, p.status,
       p.weight, p.cod_amount,
       origin.name AS origin_hub,
       destination.name AS destination_hub,
       current_hub.name AS current_hub
FROM parcels AS p
INNER JOIN hubs AS origin ON origin.id = p.origin_hub_id
INNER JOIN hubs AS destination ON destination.id = p.destination_hub_id
LEFT JOIN hubs AS current_hub ON current_hub.id = p.current_hub_id
WHERE p.tracking_number = 'DX-20261001-001'
LIMIT 1;

-- Query 11 | Aggregate-GROUP BY
SELECT transfer_id, COUNT(*) AS parcel_count
FROM transfer_parcels
WHERE transfer_id IN (1)
GROUP BY transfer_id;

-- Query 12 | Subquery
SELECT p.tracking_number, p.status,
       (
           SELECT MAX(d.delivered_at)
           FROM deliveries AS d
           WHERE d.parcel_id = p.id
             AND d.status = 'DELIVERED'
       ) AS delivered_at
FROM parcels AS p
ORDER BY p.tracking_number;
