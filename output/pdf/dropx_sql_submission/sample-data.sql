-- Sample data for re-running the project queries.
-- INSERT IGNORE makes this seed block safe to run more than once.

INSERT IGNORE INTO roles (id, name, description) VALUES
  (1, 'ADMIN', 'Full system administrator'),
  (2, 'RIDER', 'Pickup and delivery rider');

INSERT IGNORE INTO branches
  (id, name, code, phone, address, city, district, status) VALUES
  (1, 'Dhaka Central Branch', 'DHK-01', '01700000001',
   'Tejgaon, Dhaka', 'Dhaka', 'Dhaka', 'ACTIVE'),
  (2, 'Chattogram Branch', 'CTG-01', '01700000002',
   'Agrabad, Chattogram', 'Chattogram', 'Chattogram', 'ACTIVE');

INSERT IGNORE INTO hubs
  (id, branch_id, name, code, address, district, capacity, status) VALUES
  (1, 1, 'Tejgaon Hub', 'DHK-TEJ', 'Tejgaon I/A', 'Dhaka', 5000, 'ACTIVE'),
  (2, 1, 'Mirpur Hub', 'DHK-MIR', 'Mirpur 10', 'Dhaka', 2500, 'ACTIVE'),
  (3, 2, 'Agrabad Hub', 'CTG-AGR', 'Agrabad C/A', 'Chattogram', 3000, 'ACTIVE');

INSERT IGNORE INTO hub_services (hub_id, service) VALUES
  (1, 'PICKUP'), (1, 'SORTING'), (1, 'DELIVERY'),
  (2, 'PICKUP'), (2, 'DELIVERY'),
  (3, 'PICKUP'), (3, 'SORTING'), (3, 'DELIVERY');

INSERT IGNORE INTO users
  (id, branch_id, name, email, phone, password_hash, status) VALUES
  (1, 1, 'Nadia Karim', 'nadia.admin@example.com', '01800000001',
   '$2b$12$submission.placeholder.hash', 'ACTIVE'),
  (2, 1, 'Arif Hossain', 'arif.rider@example.com', '01800000002',
   '$2b$12$submission.placeholder.hash', 'ACTIVE');

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (1, 1), (2, 2);
INSERT IGNORE INTO user_hubs (user_id, hub_id) VALUES (1, 1), (2, 1);

INSERT IGNORE INTO riders
  (id, user_id, hub_id, employee_code, license_number,
   compensation_type, status) VALUES
  (1, 2, 1, 'RDR-0001', 'DL-DHK-10001', 'SALARIED', 'AVAILABLE');

INSERT IGNORE INTO customers
  (id, code, name, phone, email, type, status,
   consent_accepted_at, activated_at) VALUES
  (1, 'CUS-0001', 'Ayesha Rahman', '01900000001',
   'ayesha@example.com', 'INDIVIDUAL', 'ACTIVE', NOW(), NOW()),
  (2, 'CUS-0002', 'Tanvir Ahmed', '01900000002',
   'tanvir@example.com', 'BUSINESS', 'ACTIVE', NOW(), NOW()),
  (3, 'CUS-0003', 'Sadia Rahman', '01900000003',
   'sadia@example.com', 'INDIVIDUAL', 'ACTIVE', NOW(), NOW()),
  (4, 'CUS-0004', 'Nafisa Islam', '01900000004',
   'nafisa@example.com', 'INDIVIDUAL', 'TEMP', NOW(), NULL);

INSERT IGNORE INTO service_cities
  (id, name, code, service_type, status) VALUES
  (1, 'Dhaka', 'DHAKA', 'ISD', 'ACTIVE'),
  (2, 'Chattogram', 'CHATTOGRAM', 'OSD', 'ACTIVE');

INSERT IGNORE INTO service_zones
  (id, city_id, name, code, status) VALUES
  (1, 1, 'Dhaka North', 'NORTH', 'ACTIVE'),
  (2, 1, 'Dhaka South', 'SOUTH', 'ACTIVE'),
  (3, 2, 'Chattogram Metro', 'METRO', 'ACTIVE');

INSERT IGNORE INTO service_areas
  (id, zone_id, name, code, status) VALUES
  (1, 1, 'Mirpur', 'MIRPUR', 'ACTIVE'),
  (2, 2, 'Dhanmondi', 'DHANMONDI', 'ACTIVE'),
  (3, 3, 'Agrabad', 'AGRABAD', 'ACTIVE');

INSERT IGNORE INTO pricing_lanes
  (id, pickup_type, delivery_type, same_city, status) VALUES
  (1, 'ISD', 'SAME_CITY', 1, 'ACTIVE'),
  (2, 'ISD', 'DIFFERENT_CITY', 0, 'ACTIVE');

INSERT IGNORE INTO pricing_slabs
  (id, pricing_lane_id, min_weight_grams, max_weight_grams,
   base_fee, extra_kg_fee, cod_percentage, cod_fixed_fee, status) VALUES
  (1, 1, 0, 500, 80.00, 25.00, 1.00, 10.00, 'ACTIVE'),
  (2, 1, 501, 1000, 110.00, 25.00, 1.00, 10.00, 'ACTIVE'),
  (3, 2, 0, 500, 130.00, 35.00, 1.00, 10.00, 'ACTIVE');

INSERT IGNORE INTO parcels
  (id, tracking_number, sender_customer_id, receiver_customer_id,
   receiver_name, receiver_phone, origin_hub_id, destination_hub_id,
   current_hub_id, weight, parcel_type, payment_type, cod_amount,
   delivery_fee, status, created_at) VALUES
  (1, 'DX-20261001-001', 1, 2, 'Tanvir Ahmed', '01900000002',
   1, 3, 1, 1.20, 'PACKAGE', 'COD', 1800.00, 150.00,
   'AT_HUB', '2026-10-10 09:15:00'),
  (2, 'DX-20261002-002', 2, 1, 'Ayesha Rahman', '01900000001',
   3, 1, 1, 0.40, 'DOCUMENT', 'PREPAID', 0.00, 120.00,
   'IN_TRANSIT', '2026-10-11 11:30:00'),
  (3, 'DX-20261003-003', 1, 3, 'Sadia Rahman', '01900000003',
   1, 2, 2, 0.80, 'FRAGILE', 'COD', 2500.00, 100.00,
   'OUT_FOR_DELIVERY', '2026-10-12 14:20:00'),
  (4, 'DX-20261004-004', 3, 1, 'Ayesha Rahman', '01900000001',
   2, 1, 1, 2.10, 'PACKAGE', 'PREPAID', 0.00, 90.00,
   'DELIVERED', '2026-10-13 08:05:00'),
  (5, 'DX-20261005-005', 2, NULL, 'Mahmud Hasan', '01900000004',
   1, 3, 1, 1.75, 'PACKAGE', 'COD', 3200.00, 170.00,
   'CREATED', '2026-10-14 10:45:00');

INSERT IGNORE INTO deliveries
  (id, parcel_id, hub_id, rider_id, attempt_no, delivery_address,
   assigned_at, out_for_delivery_at, delivered_at, status) VALUES
  (1, 3, 2, 1, 1, 'Mirpur, Dhaka', '2026-10-14 08:00:00',
   '2026-10-14 09:00:00', NULL, 'OUT_FOR_DELIVERY'),
  (2, 4, 1, 1, 1, 'Tejgaon, Dhaka', '2026-10-13 09:00:00',
   '2026-10-13 10:00:00', '2026-10-13 12:15:00', 'DELIVERED');

INSERT IGNORE INTO parcel_events
  (id, parcel_id, event_type, hub_id, user_id, rider_id,
   description, created_at) VALUES
  (1, 1, 'CREATED', 1, 1, NULL,
   'Parcel booking confirmed.', '2026-10-10 09:15:00'),
  (2, 1, 'PICKED_UP', 1, NULL, 1,
   'Parcel collected from sender.', '2026-10-10 12:30:00'),
  (3, 1, 'ARRIVED_HUB', 1, 1, NULL,
   'Parcel received at Tejgaon Hub.', '2026-10-11 08:20:00'),
  (4, 3, 'OUT_FOR_DELIVERY', 2, NULL, 1,
   'Rider started the delivery attempt.', '2026-10-14 09:00:00'),
  (5, 4, 'DELIVERED', 1, NULL, 1,
   'Parcel delivered to the recipient.', '2026-10-13 12:15:00');

INSERT IGNORE INTO transfers
  (id, transfer_number, from_hub_id, to_hub_id, route_id,
   vehicle_id, driver_id, status, departed_at) VALUES
  (1, 'TRF-2026-0001', 1, 3, NULL, NULL, 1,
   'IN_TRANSIT', '2026-10-11 09:00:00');

INSERT IGNORE INTO transfer_parcels
  (transfer_id, parcel_id, loaded_at, unloaded_at) VALUES
  (1, 1, '2026-10-11 08:45:00', NULL),
  (1, 2, '2026-10-11 08:50:00', NULL);

INSERT IGNORE INTO parcel_drafts
  (id, customer_id, payload) VALUES
  (1, 1, JSON_OBJECT(
      'receiverName', 'Draft Receiver',
      'receiverPhone', '01900000999',
      'weight', '1.00'
  ));

INSERT IGNORE INTO payments
  (id, parcel_id, type, amount, method, status, paid_at) VALUES
  (1, 4, 'DELIVERY_FEE', 90.00, 'BKASH', 'PAID', '2026-10-13 12:20:00'),
  (2, 3, 'COD', 2500.00, 'CASH', 'PENDING', NULL);

INSERT IGNORE INTO support_tickets
  (id, customer_id, parcel_id, assigned_to, subject, description,
   priority, status, created_at) VALUES
  (1, 1, 1, NULL, 'Parcel delayed at hub',
   'Please confirm the next transfer time.', 'HIGH', 'OPEN',
   '2026-10-13 16:00:00');

INSERT IGNORE INTO notifications
  (id, customer_id, parcel_id, channel, event_type, recipient,
   message, status, created_at) VALUES
  (1, 1, 1, 'SMS', 'TEST_FAILURE', '01900000001',
   'Old failed test notification', 'FAILED', '2026-08-01 09:00:00'),
  (2, 3, 3, 'EMAIL', 'OUT_FOR_DELIVERY', 'sadia@example.com',
   'Your parcel is out for delivery.', 'SENT', '2026-10-14 09:05:00');
