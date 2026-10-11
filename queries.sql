-- DropX SQL, by feature.
-- Straight from apps/api/src. "?" is a parameter, ${...} is a TypeScript
-- interpolation filled in at runtime. Reference only -- schema is migrate.sql.


-- auth

SELECT id, status FROM users WHERE id = ? LIMIT 1;

SELECT id, email, name, avatar_url, password_hash, must_change_password, status
         FROM users
        WHERE email = ?
        LIMIT 1;

SELECT id, hub_id FROM riders WHERE user_id = ? LIMIT 1;

SELECT id, name, phone, email, status
         FROM customers
        WHERE phone = ? OR email = ?
        LIMIT 1;

INSERT INTO customers (code, name, phone, email, type, status, consent_accepted_at)
       VALUES (?, ?, ?, ?, 'INDIVIDUAL', 'TEMP', CURRENT_TIMESTAMP);

UPDATE customers
          SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP
        WHERE id = ?;

SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ? LIMIT 1;

UPDATE customers SET name = ? WHERE id = ?;

UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;

UPDATE users SET password_hash = ?, must_change_password = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ? LIMIT 1;

-- tracking

SELECT p.id, p.tracking_number, p.parcel_type, p.payment_type, p.status,
         p.weight, p.cod_amount,
         (SELECT MAX(d.delivered_at) FROM deliveries d WHERE d.parcel_id = p.id AND d.status = 'DELIVERED') AS delivered_at,
         origin.code AS origin_code, origin.name AS origin_name, origin.district AS origin_district,
         dest.code  AS destination_code, dest.name AS destination_name, dest.district AS destination_district,
         current.code AS current_code, current.name AS current_name, current.district AS current_district
    FROM parcels p
    JOIN hubs origin ON origin.id = p.origin_hub_id
    JOIN hubs dest   ON dest.id   = p.destination_hub_id
    LEFT JOIN hubs current ON current.id = p.current_hub_id;

${TRACKING_SELECT} WHERE p.tracking_number = ? LIMIT 1;

SELECT e.event_type, e.description, e.created_at, h.name AS hub_name
         FROM parcel_events e
         LEFT JOIN hubs h ON h.id = e.hub_id
        WHERE e.parcel_id = ?
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 100;

-- customers

SELECT ${CUSTOMER_COLUMNS} FROM customers AS c ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM customers AS c${where ? " " + where : ""};

SELECT ${CUSTOMER_COLUMNS} FROM customers AS c WHERE c.id = ?;

SELECT a.id, a.customer_id, a.label, a.city_id, a.zone_id, a.area_id,
            a.address_line, a.landmark, a.latitude, a.longitude,
            a.is_default, a.created_at, a.updated_at,
            city.name AS city_name, zone.name AS zone_name, area.name AS area_name
       FROM customer_addresses AS a
       JOIN service_cities AS city ON city.id = a.city_id
       JOIN service_zones AS zone ON zone.id = a.zone_id
       LEFT JOIN service_areas AS area ON area.id = a.area_id
      WHERE a.customer_id = ?
      ORDER BY a.is_default DESC, a.id ASC;

UPDATE customers
        SET status = 'ACTIVE', activated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'TEMP';

-- customer-addresses

INSERT INTO customer_addresses
    (customer_id, label, city_id, zone_id, area_id, address_line, landmark, latitude, longitude, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false);

SELECT ${ADDRESS_COLUMNS}, city.name AS city_name, zone.name AS zone_name, area.name AS area_name
       FROM customer_addresses AS a${ADDRESS_JOINS}
      WHERE a.customer_id = ? AND a.id = ?
      LIMIT 1;

SELECT ${ADDRESS_COLUMNS}, city.name AS city_name, zone.name AS zone_name, area.name AS area_name
       FROM customer_addresses AS a${ADDRESS_JOINS}
      WHERE a.customer_id = ?
      ORDER BY a.is_default DESC, a.id ASC;

UPDATE customer_addresses SET ${assignments.join(", ")} WHERE customer_id = ? AND id = ?;

DELETE FROM customer_addresses WHERE customer_id = ? AND id = ?;

-- customer-profile

SELECT ${PROFILE_COLUMNS} FROM customers WHERE id = ?;

UPDATE customers SET ${sets.join(", ")} WHERE id = ?;

-- roles

SELECT id FROM roles WHERE name = ? LIMIT 1;

SELECT ${ROLE_COLUMNS} FROM ${ROLE_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${ROLE_FROM}${where ? " " + where : ""};

SELECT ${ROLE_COLUMNS} FROM ${ROLE_FROM} WHERE r.id = ?;

SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key;

INSERT INTO roles (name, description) VALUES (?, ?);

DELETE FROM role_permissions WHERE role_id = ?;

INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?);

SELECT COUNT(DISTINCT ur.user_id) AS count
       FROM user_roles AS ur
       INNER JOIN role_permissions AS rp ON rp.role_id = ur.role_id
       INNER JOIN users AS u ON u.id = ur.user_id
      WHERE rp.permission_key = ? AND u.status = 'ACTIVE' AND ur.role_id <> ?;

-- users

SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1;

u.id IN (SELECT uh.user_id FROM user_hubs AS uh WHERE uh.hub_id IN (${scope.hubIds
        .map(() => "?")
        .join(", ")}));

SELECT ${USER_COLUMNS} FROM ${USER_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${USER_FROM}${where ? " " + where : ""};

SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE ${clauses.join(" AND ")};

SELECT ur.user_id, ur.role_id, r.name AS role_name
       FROM user_roles AS ur
       INNER JOIN roles AS r ON r.id = ur.role_id
      WHERE ur.user_id IN (${userIds.map(() => "?").join(", ")})
      ORDER BY r.name ASC;

SELECT uh.user_id, uh.hub_id, h.name AS hub_name
       FROM user_hubs AS uh
       INNER JOIN hubs AS h ON h.id = uh.hub_id
      WHERE uh.user_id IN (${userIds.map(() => "?").join(", ")})
      ORDER BY h.name ASC;

SELECT role_id FROM user_roles WHERE user_id = ?;

SELECT id FROM roles WHERE name = ? LIMIT 1;

SELECT COUNT(DISTINCT u.id) AS count
       FROM users AS u
       INNER JOIN user_roles AS ur ON ur.user_id = u.id
       INNER JOIN roles AS r ON r.id = ur.role_id
      WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE' AND u.id <> ?;

SELECT id FROM ${EXISTING_TABLES[table]} WHERE id IN (${unique.map(() => "?").join(", ")});

INSERT INTO users (name, email, phone, password_hash, must_change_password, status, branch_id)
     VALUES (?, ?, ?, ?, TRUE, ?, ?);

UPDATE users SET ${assignments.join(", ")} WHERE id = ?;

DELETE FROM user_roles WHERE user_id = ?;

INSERT INTO user_roles (user_id, role_id) VALUES (?, ?);

DELETE FROM user_hubs WHERE user_id = ?;

INSERT INTO user_hubs (user_id, hub_id) VALUES (?, ?);

UPDATE users SET password_hash = ?, must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- user-profile

SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?;

UPDATE users SET ${sets.join(", ")} WHERE id = ?;

-- org

h.id, h.branch_id, h.name, h.code, h.address, h.district,
  h.latitude, h.longitude, h.capacity, h.status, h.created_at, h.updated_at,
  br.name AS branch_name, br.code AS branch_code,
  COALESCE(
    (SELECT JSON_ARRAYAGG(hs.service) FROM hub_services AS hs WHERE hs.hub_id = h.id),
    JSON_ARRAY()
  ) AS services;

SELECT COUNT(*) AS count FROM branches AS b${where ? " " + where : ""};

SELECT ${BRANCH_COLUMNS} FROM branches AS b ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT ${BRANCH_COLUMNS} FROM branches AS b WHERE b.id = ?;

INSERT INTO branches (name, code, phone, address, city, district, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

UPDATE branches SET ${assignments.join(", ")} WHERE id = ?;

EXISTS (SELECT 1 FROM hub_services AS hs_filter WHERE hs_filter.hub_id = h.id AND hs_filter.service = ?);

SELECT COUNT(*) AS count FROM hubs AS h${where ? " " + where : ""};

SELECT ${HUB_COLUMNS} FROM hubs AS h LEFT JOIN branches AS br ON br.id = h.branch_id ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT ${HUB_COLUMNS} FROM hubs AS h LEFT JOIN branches AS br ON br.id = h.branch_id WHERE h.id = ?;

INSERT INTO hubs (branch_id, name, code, address, district, latitude, longitude, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

UPDATE hubs SET ${assignments.join(", ")} WHERE id = ?;

DELETE FROM hub_services WHERE hub_id = ?;

INSERT INTO hub_services (hub_id, service) VALUES ${placeholders};

-- locations

SELECT ${CITY_COLUMNS} FROM service_cities AS c ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM service_cities AS c${where ? " " + where : ""};

SELECT ${CITY_COLUMNS} FROM service_cities AS c WHERE c.id = ?;

INSERT INTO service_cities (name, code, service_type, status) VALUES (?, ?, ?, ?);

UPDATE service_cities SET ${assignments.join(", ")} WHERE id = ?;

SELECT ${ZONE_COLUMNS} FROM service_zones AS z ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM service_zones AS z${where ? " " + where : ""};

SELECT ${ZONE_COLUMNS} FROM service_zones AS z WHERE z.id = ?;

INSERT INTO service_zones (city_id, name, code, status) VALUES (?, ?, ?, ?);

UPDATE service_zones SET ${assignments.join(", ")} WHERE id = ?;

SELECT ${AREA_COLUMNS} FROM service_areas AS a ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM service_areas AS a${where ? " " + where : ""};

SELECT ${AREA_COLUMNS} FROM service_areas AS a WHERE a.id = ?;

INSERT INTO service_areas (zone_id, name, code, status) VALUES (?, ?, ?, ?);

UPDATE service_areas SET ${assignments.join(", ")} WHERE id = ?;

SELECT 1 FROM ${table} WHERE ${clauses.join(" AND ")} LIMIT 1;

-- reference

h.id, h.name, h.code, h.district, h.status,
  COALESCE(
    (SELECT JSON_ARRAYAGG(hs.service) FROM hub_services AS hs WHERE hs.hub_id = h.id),
    JSON_ARRAY()
  ) AS services;

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT COUNT(*) AS count FROM branches AS b${where ? " " + where : ""};

SELECT ${BRANCH_COLUMNS} FROM branches AS b${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?;

EXISTS (SELECT 1 FROM hub_services AS hs_filter WHERE hs_filter.hub_id = h.id AND hs_filter.service = ?);

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT COUNT(*) AS count FROM hubs AS h${where ? " " + where : ""};

SELECT ${HUB_COLUMNS} FROM hubs AS h${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?;

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT COUNT(*) AS count FROM customers AS c${where ? " " + where : ""};

SELECT ${CUSTOMER_COLUMNS} FROM customers AS c${where ? " " + where : ""} ORDER BY ${orderByClause} LIMIT ? OFFSET ?;

-- parcels

SELECT ${SELECT_COLUMNS} FROM parcels AS p LEFT JOIN customers AS r ON r.id = p.receiver_customer_id LEFT JOIN hubs AS scope_hub ON ${SCOPE_JOIN_ON};

LEFT JOIN customers AS r ON r.id = p.receiver_customer_id LEFT JOIN hubs AS scope_hub ON ${SCOPE_JOIN_ON};

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT COUNT(*) AS count FROM parcels AS p${PARCEL_JOINS}${where ? " " + where : ""};

SELECT ${SELECT_COLUMNS} FROM parcels AS p${PARCEL_JOINS} ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?;

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT ${SELECT_COLUMNS} FROM parcels AS p WHERE p.tracking_number = ? LIMIT 1;

SELECT ${SELECT_COLUMNS} FROM parcels AS p WHERE p.id = ? AND (p.sender_customer_id = ? OR p.receiver_customer_id = ?) LIMIT 1;

WHERE (${clauses.map((c) => c.text).join(") AND (")});

SELECT COUNT(*) AS count FROM parcels AS p${PARCEL_JOINS}${where ? " " + where : ""};

SELECT ${SELECT_COLUMNS} FROM parcels AS p${PARCEL_JOINS} ${where} ORDER BY ${orderByClause} LIMIT ? OFFSET ?;

SELECT h.id, h.district, h.latitude, h.longitude,
      COALESCE(
        (SELECT JSON_ARRAYAGG(hs.service) FROM hub_services AS hs WHERE hs.hub_id = h.id),
        JSON_ARRAY()
      ) AS services
     FROM hubs AS h
     WHERE h.status = 'ACTIVE'
     ORDER BY h.id ASC;

INSERT INTO parcels (${fields.join(", ")}) VALUES (${placeholders(fields.length)});

INSERT INTO parcel_items (${fields.join(", ")}) VALUES (${placeholders(fields.length)});

INSERT INTO parcel_addresses
      (parcel_id, type, city_id, zone_id, area_id, city_name, zone_name, area_name,
       address_line, landmark, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

SELECT id, parcel_id, type, city_id, zone_id, area_id, city_name, zone_name, area_name,
            address_line, landmark, latitude, longitude, created_at, updated_at
       FROM parcel_addresses
      WHERE parcel_id = ?
      ORDER BY type;

UPDATE parcels SET ${assignments.join(", ")} WHERE id = ?;

AND (
      COALESCE(current_hub_id, destination_hub_id) IN (
        SELECT id FROM hubs WHERE 1 = 1
        ${scope.branchId ? "AND branch_id = ?" : ""}
        ${scope.hubIds.length > 0 ? `AND id IN (${scope.hubIds.map(() => "?").join(", ")})` : ""}
      )
    );

SELECT p.id FROM parcels AS p
     LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
     WHERE ${clauses.join(" AND ")} LIMIT 1 FOR UPDATE;

INSERT INTO parcel_events (${fields.join(", ")}) VALUES (${placeholders(fields.length)});

SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM parcel_items
      WHERE parcel_id = ?
      ORDER BY id;

INSERT INTO parcel_drafts (customer_id, payload) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE payload = ?;

SELECT id, customer_id, payload, updated_at
       FROM parcel_drafts
      WHERE customer_id = ?
      LIMIT 1;

DELETE FROM parcel_drafts WHERE customer_id = ?;

-- pickups

UPDATE parcels SET status = 'PICKED_UP' WHERE id = ?;

SELECT ${PICKUP_COLUMNS} FROM ${PICKUP_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${PICKUP_FROM}${where ? " " + where : ""};

SELECT ${PICKUP_COLUMNS} FROM ${PICKUP_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    };

SELECT COUNT(*) AS count FROM pickups
     WHERE parcel_id = ? AND status IN (${OPEN_PICKUP_STATUSES.map(() => "?").join(", ")});

INSERT INTO pickups (parcel_id, requested_by, pickup_address, scheduled_at, status) VALUES (?, ?, ?, ?, ?);

UPDATE pickups SET assigned_rider_id = ?, scheduled_at = ?, status = 'ASSIGNED' WHERE id = ?;

UPDATE pickups AS pk
    LEFT JOIN parcels AS p ON p.id = pk.parcel_id
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
    SET ${assignments.map((a) => "pk." + a).join(", ")} WHERE pk.id = ?;

-- transfers

EXISTS (SELECT 1 FROM hubs AS sh WHERE sh.id IN ${ends} AND sh.branch_id = ?);

EXISTS (SELECT 1 FROM hubs AS sh WHERE sh.id IN ${ends} AND sh.id IN (${scope.hubIds
        .map(() => "?")
        .join(", ")}));

EXISTS (SELECT 1 FROM hubs AS wh WHERE wh.id = t.from_hub_id AND wh.branch_id = ?);

WHERE (${clauses.join(") AND (")});

${TRANSFER_FROM} LEFT JOIN vehicles AS v ON v.id = t.vehicle_id;

SELECT ${TRANSFER_COLUMNS}, ${HUB_COLUMNS} FROM ${from} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${from} ${where};

SELECT transfer_id, COUNT(*) AS parcel_count
       FROM transfer_parcels
       WHERE transfer_id IN (${placeholders})
       GROUP BY transfer_id;

SELECT ${TRANSFER_COLUMNS}, ${HUB_COLUMNS} FROM ${TRANSFER_FROM}
     WHERE ${clauses.join(" AND ")} LIMIT 1${options.forUpdate ? " FOR UPDATE" : ""};

SELECT tp.parcel_id, tp.loaded_at, tp.unloaded_at, p.tracking_number, p.status
     FROM transfer_parcels AS tp
     JOIN parcels AS p ON p.id = tp.parcel_id
     WHERE tp.transfer_id = ?
     ORDER BY p.tracking_number;

SELECT id FROM users WHERE (id = ? OR email = ?) AND status = 'ACTIVE' LIMIT 1;

SELECT h.id
       FROM hubs AS h
      WHERE h.id = ?
        AND h.status = 'ACTIVE'
        ${service ? "AND EXISTS (SELECT 1 FROM hub_services AS hs WHERE hs.hub_id = h.id AND hs.service = ?)" : ""}
      LIMIT 1;

SELECT id FROM vehicles WHERE id = ? AND status = 'ACTIVE' LIMIT 1;

SELECT id FROM routes WHERE id = ? AND status = 'ACTIVE' LIMIT 1;

INSERT INTO transfers (transfer_number, from_hub_id, to_hub_id, route_id, vehicle_id, driver_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?);

UPDATE transfers AS t SET ${assignments.join(", ")} WHERE t.id = ?;

UPDATE transfers AS t SET ${assignments.join(", ")} WHERE t.id = ?;

DELETE FROM transfers AS t WHERE t.id = ?;

DELETE FROM transfer_parcels WHERE transfer_id = ?;

INSERT INTO transfer_parcels (transfer_id, parcel_id) VALUES ${values};

UPDATE transfer_parcels SET loaded_at = NOW() WHERE transfer_id = ? AND loaded_at IS NULL;

UPDATE transfer_parcels SET unloaded_at = NOW() WHERE transfer_id = ? AND unloaded_at IS NULL;

SELECT parcel_id FROM transfer_parcels WHERE transfer_id = ? ORDER BY parcel_id;

SELECT COUNT(*) AS count FROM transfer_parcels WHERE transfer_id = ?;

SELECT id, status FROM parcels WHERE current_hub_id = ? AND id IN (${placeholders})
     FOR UPDATE;

UPDATE parcels SET status = ? WHERE id IN (${placeholders});

UPDATE parcels SET current_hub_id = ? WHERE id IN (${placeholders});

-- deliveries

SELECT ${DELIVERY_COLUMNS} FROM ${DELIVERY_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${DELIVERY_FROM}${where ? " " + where : ""};

SELECT ${DELIVERY_COLUMNS} FROM ${DELIVERY_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    };

SELECT COUNT(*) AS count FROM deliveries
     WHERE parcel_id = ? AND status IN (${OPEN_DELIVERY_STATUSES.map(() => "?").join(", ")});

SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next FROM deliveries WHERE parcel_id = ?;

SELECT COALESCE(p.current_hub_id, p.destination_hub_id) AS hub_id, p.status
       FROM parcels AS p
       LEFT JOIN hubs AS scope_hub ON scope_hub.id = COALESCE(p.current_hub_id, p.destination_hub_id)
      WHERE ${clauses.join(" AND ")} LIMIT 1;

INSERT INTO deliveries (parcel_id, hub_id, rider_id, attempt_no, delivery_address, assigned_at, status) VALUES (?, ?, ?, ?, ?, NOW(), 'ASSIGNED');

UPDATE deliveries AS d
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET d.rider_id = ?, d.assigned_at = NOW()
    WHERE d.id = ? AND d.status = 'ASSIGNED';

UPDATE deliveries AS d
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET ${assignments.map((a) => "d." + a).join(", ")}
    WHERE d.id = ?;

SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${PROOF_FROM}${where ? " " + where : ""};

SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    };

SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} WHERE dp.id = ? LIMIT 1;

INSERT INTO delivery_proofs (delivery_id, type, value, file_url) VALUES (?, ?, ?, ?);

UPDATE delivery_proofs AS dp
    JOIN deliveries AS d ON d.id = dp.delivery_id
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET dp.verified_at = NOW()
    WHERE dp.id = ? AND dp.verified_at IS NULL;

SELECT ${PROOF_COLUMNS}
       FROM ${PROOF_FROM}
      WHERE d.rider_id = ? AND p.id = ?
      ORDER BY dp.created_at DESC, dp.id DESC;

SELECT d.id, d.status
       FROM deliveries AS d
      WHERE d.rider_id = ? AND d.parcel_id = ?
        AND d.status IN ('OUT_FOR_DELIVERY', 'DELIVERED')
      ORDER BY d.attempt_no DESC
      LIMIT 1;

UPDATE parcels SET status = ? WHERE id = ?;

-- routes

SELECT ${ROUTE_COLUMNS} FROM routes AS r ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM routes AS r${where ? " " + where : ""};

SELECT ${ROUTE_COLUMNS} FROM routes AS r WHERE r.id = ?;

INSERT INTO routes (name, code, origin_hub_id, destination_hub_id, distance_km, estimated_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?);

UPDATE routes SET ${assignments.join(", ")} WHERE id = ?;

DELETE FROM routes WHERE id = ?;

SELECT id, route_id, hub_id, sequence_no, estimated_arrival_minutes
       FROM route_stops
      WHERE route_id = ?
      ORDER BY sequence_no ASC;

DELETE FROM route_stops WHERE route_id = ?;

INSERT INTO route_stops (route_id, hub_id, sequence_no, estimated_arrival_minutes) VALUES (?, ?, ?, ?);

SELECT h.id
       FROM hubs AS h
       JOIN hub_services AS hs ON hs.hub_id = h.id
      WHERE h.id IN (${placeholders}) AND h.status = 'ACTIVE' AND hs.service = ?;

-- vehicles

SELECT ${VEHICLE_COLUMNS} FROM vehicles AS v ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM vehicles AS v${where ? " " + where : ""};

SELECT ${VEHICLE_COLUMNS} FROM vehicles AS v WHERE v.id = ?;

INSERT INTO vehicles (registration_number, type, capacity_kg, status) VALUES (?, ?, ?, ?);

UPDATE vehicles SET ${assignments.join(", ")} WHERE id = ?;

-- pricing

SELECT ${LANE_COLUMNS} FROM pricing_lanes AS l ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM pricing_lanes AS l${where ? " " + where : ""};

SELECT ${LANE_COLUMNS} FROM pricing_lanes AS l WHERE l.id = ?;

SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s
      WHERE s.pricing_lane_id IN (${placeholders})
      ORDER BY ${SLAB_ORDER};

SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s WHERE s.id = ?;

SELECT ${SLAB_COLUMNS} FROM pricing_slabs AS s WHERE ${clauses.join(" AND ")} LIMIT 1;

UPDATE pricing_lanes SET ${assignments.join(", ")} WHERE id = ?;

INSERT INTO pricing_slabs
       (pricing_lane_id, min_weight_grams, max_weight_grams, base_fee, extra_kg_fee,
        cod_percentage, cod_fixed_fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);

UPDATE pricing_slabs SET ${assignments.join(", ")} WHERE id = ?;

UPDATE pricing_slabs SET cod_percentage = ?, cod_fixed_fee = ?;

SELECT id, pickup_type, delivery_type, same_city
       FROM pricing_lanes
      WHERE status = 'ACTIVE'
        AND pickup_type = ?
        AND delivery_type = ?
        AND same_city = ?
      LIMIT 1;

-- payments

SELECT ${PAYMENT_COLUMNS}
      FROM payments AS p
      INNER JOIN parcels AS par ON par.id = p.parcel_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM payments AS p${where ? " " + where : ""};

SELECT ${PAYMENT_COLUMNS}
      FROM payments AS p
      INNER JOIN parcels AS par ON par.id = p.parcel_id
      WHERE p.id = ?;

SELECT payment_type, cod_amount
       FROM parcels
      WHERE id = ?${forUpdate ? " FOR UPDATE" : ""};

SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
      WHERE parcel_id = ? AND type = ? AND status = 'PAID';

INSERT INTO payments (parcel_id, type, amount, method, status, paid_at)
     VALUES (?, ?, ?, ?, 'PAID', CURRENT_TIMESTAMP);

UPDATE payments
        SET status = 'REFUNDED'
      WHERE parcel_id = ? AND type = 'COD' AND status = 'PAID';

-- settlements

SELECT ${SETTLEMENT_COLUMNS}
      FROM settlements AS s
      INNER JOIN customers AS c ON c.id = s.customer_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM settlements AS s${where ? " " + where : ""};

SELECT ${SETTLEMENT_COLUMNS}
      FROM settlements AS s
      INNER JOIN customers AS c ON c.id = s.customer_id
     WHERE s.id = ?;

SELECT
       COALESCE(SUM(CASE WHEN p.type = 'COD' THEN p.amount END), 0) AS total_cod,
       COALESCE(SUM(CASE WHEN p.type = 'DELIVERY_FEE' THEN p.amount END), 0) AS delivery_charges
       FROM payments AS p
       INNER JOIN parcels AS par ON par.id = p.parcel_id
      WHERE par.sender_customer_id = ?
        AND p.status = 'PAID'
        AND p.paid_at >= ? AND p.paid_at < DATE_ADD(?, INTERVAL 1 DAY);

SELECT id FROM customers WHERE id = ? FOR UPDATE;

SELECT id FROM settlements
      WHERE customer_id = ? AND period_start = ? AND period_end = ?
      LIMIT 1;

INSERT INTO settlements
      (code, customer_id, period_start, period_end, total_cod, delivery_charges,
       other_charges, net_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING');

UPDATE settlements
        SET status = ?,
            paid_at = CASE WHEN ? = 'PAID' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = ?;

-- riders

SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1;

INSERT INTO ${TABLES.users} (name, email, phone, password_hash, must_change_password, status)
         VALUES (?, ?, ?, ?, TRUE, 'ACTIVE');

SELECT id FROM ${TABLES.roles} WHERE name = 'RIDER' LIMIT 1;

INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?);

SELECT ${RIDER_LOCATION_COLUMNS} FROM ${RIDER_LOCATION_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${RIDER_LOCATION_FROM}${where ? " " + where : ""};

INSERT INTO rider_locations (rider_id, latitude, longitude, recorded_at) VALUES (?, ?, ?, ?);

SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM ${RIDER_FROM}${where ? " " + where : ""};

SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} WHERE r.id = ?;

SELECT ${RIDER_COLUMNS} FROM ${RIDER_FROM} WHERE r.user_id = ?;

INSERT INTO riders (user_id, hub_id, employee_code, license_number, compensation_type, status) VALUES (?, ?, ?, ?, ?, ?);

UPDATE riders SET ${assignments.join(", ")} WHERE id = ?;

-- rider-applications

SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1;

INSERT INTO ${TABLES.users} (name, email, phone, password_hash, must_change_password, status) VALUES (?, ?, ?, ?, TRUE, 'ACTIVE');

SELECT id FROM ${TABLES.roles} WHERE name = 'RIDER' LIMIT 1;

INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?);

UPDATE rider_applications SET status = 'APPROVED' WHERE id = ?;

SELECT ${COLUMNS} FROM rider_applications ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?;

SELECT COUNT(*) AS count FROM rider_applications${where ? ` ${where}` : ""};

UPDATE rider_applications SET status = ? WHERE id = ?;

SELECT ${COLUMNS} FROM rider_applications WHERE id = ?;

SELECT ${COLUMNS} FROM rider_applications WHERE id = ?${forUpdate ? " FOR UPDATE" : ""};

INSERT INTO rider_applications
      (name, phone, email, district, vehicle_type, license_number, experience_years, availability, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- jobs

WHERE ${clauses.join(" AND ")};

SELECT COUNT(*) AS count ${from} ${where};

SELECT ${PICKUP_JOB_COLUMNS} ${from} ${where} ORDER BY pk.created_at DESC, pk.id DESC LIMIT ? OFFSET ?;

SELECT ${PICKUP_JOB_COLUMNS} FROM pickups AS pk INNER JOIN parcels AS p ON p.id = pk.parcel_id
     WHERE pk.assigned_rider_id = ? AND pk.id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""};

WHERE (${clauses.map((c) => c.sql).join(") AND (")});

SELECT COUNT(*) AS count FROM deliveries AS d INNER JOIN parcels AS p ON p.id = d.parcel_id${where ? " " + where : ""};

SELECT ${JOB_COLUMNS} FROM deliveries AS d INNER JOIN parcels AS p ON p.id = d.parcel_id${JOB_JOINS}${where ? " " + where : ""} ORDER BY d.attempt_no DESC, d.id DESC LIMIT ? OFFSET ?;

SELECT ${JOB_COLUMNS} FROM deliveries AS d JOIN parcels AS p ON p.id = d.parcel_id${JOB_JOINS} WHERE d.rider_id = ? AND d.parcel_id = ? ORDER BY d.attempt_no DESC LIMIT 1;

SELECT id, parcel_id, name, description, quantity, unit_price, total_price, created_at
       FROM parcel_items
      WHERE parcel_id = ?
      ORDER BY id;

SELECT d.id, d.attempt_no, d.status, d.parcel_id, p.status AS status_before
       FROM deliveries AS d
       JOIN parcels AS p ON p.id = d.parcel_id
      WHERE d.rider_id = ? AND d.parcel_id = ?
        AND d.status IN ('ASSIGNED', 'OUT_FOR_DELIVERY')
      ORDER BY d.attempt_no DESC
      LIMIT 1
      FOR UPDATE;

UPDATE deliveries
        SET status = ?,
            failure_reason = COALESCE(?, failure_reason),
            out_for_delivery_at = CASE WHEN ? = 'OUT_FOR_DELIVERY' THEN NOW() ELSE out_for_delivery_at END,
            delivered_at = CASE WHEN ? = 'DELIVERED' THEN NOW() ELSE delivered_at END
      WHERE id = ? AND attempt_no = ?;

UPDATE pickups
          SET status = ?,
              picked_up_at = CASE WHEN ? = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
              failure_reason = CASE WHEN ? = 'FAILED' THEN ? ELSE NULL END
        WHERE id = ? AND assigned_rider_id = ?;

UPDATE parcels SET status = ? WHERE id = ?;

UPDATE parcels SET status = ?, current_hub_id = current_hub_id WHERE id = ?;

-- admin

SELECT id FROM ${TABLES.roles} WHERE name = ? LIMIT 1;

SELECT id FROM ${TABLES.roles} WHERE name = ? FOR UPDATE;

SELECT COUNT(*) AS total FROM ${TABLES.userRoles} WHERE role_id = ?;

SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1;

INSERT INTO ${TABLES.users} (name, email, password_hash, status)
       VALUES (?, ?, ?, 'ACTIVE');

INSERT INTO ${TABLES.userRoles} (user_id, role_id) VALUES (?, ?);

SELECT id, name, email, status, created_at FROM ${TABLES.users} WHERE id = ?;

-- core

SELECT id, branch_id, email, status FROM users WHERE id = ? LIMIT 1;

SELECT r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ?;

SELECT DISTINCT rp.permission_key
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = ?;

SELECT hub_id FROM user_hubs WHERE user_id = ?;

SELECT r.id, r.hub_id, r.status AS rider_status,
            u.email, u.avatar_url, u.branch_id, u.must_change_password, u.status AS user_status
       FROM riders r
       JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      LIMIT 1;

SELECT DISTINCT rp.permission_key
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?;

SELECT status FROM customers WHERE id = ? LIMIT 1;

INSERT INTO sequences (seq_name, next_value) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE next_value = LAST_INSERT_ID(next_value + 1);

WHERE (${clauses.join(") AND (")});

