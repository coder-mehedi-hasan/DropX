-- Parcel Delivery & Logistics Management System
-- Database: MySQL 8.0+
-- Single-tenant architecture
-- Migration: initial schema

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
);

-- ============================================================
-- Organization
-- ============================================================

CREATE TABLE IF NOT EXISTS branches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(500) NULL,
    city VARCHAR(100) NULL,
    district VARCHAR(100) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_branches_code (code),
    KEY idx_branches_status (status),
    KEY idx_branches_district (district)
);

CREATE TABLE IF NOT EXISTS hubs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    branch_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    type ENUM('ORIGIN','SORTING','TRANSIT','DESTINATION') NOT NULL,
    address VARCHAR(500) NULL,
    district VARCHAR(100) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    capacity INT UNSIGNED NULL,
    status ENUM('ACTIVE','INACTIVE','MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_hubs_code (code),
    KEY idx_hubs_branch_id (branch_id),
    KEY idx_hubs_type_status (type, status),
    KEY idx_hubs_district (district),
    CONSTRAINT fk_hubs_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    branch_id BIGINT UNSIGNED NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_branch_id (branch_id),
    KEY idx_users_phone (phone),
    KEY idx_users_status (status),
    CONSTRAINT fk_users_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_key VARCHAR(150) NOT NULL,
    PRIMARY KEY (role_id, permission_key),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_hubs (
    user_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, hub_id),
    KEY idx_user_hubs_hub_id (hub_id),
    CONSTRAINT fk_user_hubs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_hubs_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Customers
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- Public reference (`CUS-0001`), assigned by the server from `sequences`.
    -- Separate from `id` so the number shown to staff stays stable and dense
    -- even if rows are ever re-keyed. Default '' exists only so the guarded
    -- upgrade statement below can add this column to a populated table; every
    -- insert supplies a real value.
    code VARCHAR(20) NOT NULL DEFAULT '',
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255) NULL,
    type ENUM('INDIVIDUAL','BUSINESS') NOT NULL DEFAULT 'INDIVIDUAL',
    -- TEMP: created on OTP request after consent; ACTIVE: after OTP verified
    status ENUM('TEMP','ACTIVE') NOT NULL DEFAULT 'TEMP',
    -- Public URL of the customer's uploaded avatar; NULL means the initials
    -- fallback in the UI. The bytes live in object storage, never MySQL.
    avatar_url VARCHAR(500) NULL,
    consent_accepted_at DATETIME NULL,
    activated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_code (code),
    UNIQUE KEY uq_customers_phone (phone),
    UNIQUE KEY uq_customers_email (email),
    KEY idx_customers_type (type),
    KEY idx_customers_status (status)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(50) NULL,
    -- Structured to match the booking cascade: a saved address carries the same
    -- city/zone/area ids a booking end does, so it can prefill the picker. The
    -- old free-text `city`/`district`/`postal_code` columns are gone.
    city_id BIGINT UNSIGNED NOT NULL,
    zone_id BIGINT UNSIGNED NOT NULL,
    area_id BIGINT UNSIGNED NULL,
    address_line VARCHAR(300) NOT NULL,
    landmark VARCHAR(255) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customer_addresses_customer_id (customer_id),
    KEY idx_customer_addresses_city (city_id),
    KEY idx_customer_addresses_zone (zone_id),
    KEY idx_customer_addresses_area (area_id),
    CONSTRAINT fk_customer_addresses_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_customer_addresses_city
        FOREIGN KEY (city_id) REFERENCES service_cities(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_customer_addresses_zone
        FOREIGN KEY (zone_id) REFERENCES service_zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_customer_addresses_area
        FOREIGN KEY (area_id) REFERENCES service_areas(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ============================================================
-- Service locations (city -> zone -> area)
-- ============================================================

-- The customer-facing territory: address selection and pricing both hang off
-- this hierarchy. Deliberately separate from `hubs`, which are internal sorting
-- points — a hub is not a city and a city is not an operating location.
--
-- Rows are deactivated (`status = 'INACTIVE'`), never deleted: historical
-- parcels keep their foreign keys and their name snapshots. The flat `zones`
-- table below stays for the length of the migration as a compatibility layer.

CREATE TABLE IF NOT EXISTS service_cities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    -- ISD / SUBURB / OSD is what selects a pricing lane, so it is a column of
    -- the city rather than a property of a quote.
    service_type ENUM('ISD','SUBURB','OSD') NOT NULL DEFAULT 'ISD',
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_cities_code (code),
    KEY idx_service_cities_status (status),
    KEY idx_service_cities_service_type (service_type)
);

CREATE TABLE IF NOT EXISTS service_zones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    city_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- Scoped to the city, not global: two cities may each have a "Sadar".
    UNIQUE KEY uq_service_zones_city_code (city_id, code),
    KEY idx_service_zones_city (city_id),
    KEY idx_service_zones_status (status),
    CONSTRAINT fk_service_zones_city
        FOREIGN KEY (city_id) REFERENCES service_cities(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS service_areas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    zone_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_areas_zone_code (zone_id, code),
    KEY idx_service_areas_zone (zone_id),
    KEY idx_service_areas_status (status),
    CONSTRAINT fk_service_areas_zone
        FOREIGN KEY (zone_id) REFERENCES service_zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Pricing
-- ============================================================

-- The lane matrix is the pricing model: a lane is one row of the matrix — the
-- pickup service type, the delivery service type, and whether the two ends are
-- in the same city — and `pricing_slabs` hangs off it with one row per weight
-- band. The legacy flat `zones` and `pricing_rules` tables are gone; a booking
-- quotes from the lane matrix keyed on the two cities' service types.

CREATE TABLE IF NOT EXISTS pricing_lanes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pickup_type ENUM('ISD','SUBURB','OSD','ISD_ON_DEMAND') NOT NULL,
    delivery_type ENUM('ISD','SUBURB','OSD','SAME_CITY','DIFFERENT_CITY','SAME_CITY_ON_DEMAND') NOT NULL,
    -- Redundant with `delivery_type = 'SAME_CITY'` by construction, kept as a
    -- column because it is half of the lane's identity and the quote reads it.
    same_city TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pricing_lanes_route (pickup_type, delivery_type, same_city),
    KEY idx_pricing_lanes_status (status)
);

CREATE TABLE IF NOT EXISTS pricing_slabs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pricing_lane_id BIGINT UNSIGNED NOT NULL,
    -- Grams, not kilograms: the matrix bands are 0-200g, 201-500g, 501g-1kg,
    -- 1kg-2kg, and a kilogram column could not express the first two.
    min_weight_grams INT UNSIGNED NOT NULL,
    max_weight_grams INT UNSIGNED NOT NULL,
    base_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    -- Charged per whole kg *above* `max_weight_grams`, which is how a parcel
    -- over 2kg is priced: the top slab's base plus its extra-weight rule. It is
    -- an explicit per-lane number, not the old `price_per_kg` carry-over.
    extra_kg_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    cod_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    cod_fixed_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- Two slabs of one lane cannot share a boundary, which is the structural
    -- half of the no-overlap rule. Full overlap detection needs a row comparison
    -- and lives in `pricing-lanes.service`, which rejects an insert or an edit
    -- whose range intersects an existing slab of the same lane.
    UNIQUE KEY uq_pricing_slabs_lane_min (pricing_lane_id, min_weight_grams),
    UNIQUE KEY uq_pricing_slabs_lane_max (pricing_lane_id, max_weight_grams),
    KEY idx_pricing_slabs_lane_status (pricing_lane_id, status),
    CONSTRAINT fk_pricing_slabs_lane
        FOREIGN KEY (pricing_lane_id) REFERENCES pricing_lanes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_pricing_slabs_range
        CHECK (max_weight_grams > min_weight_grams)
);

-- ============================================================
-- Vehicles & Routes
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    registration_number VARCHAR(50) NOT NULL,
    type ENUM('BIKE','VAN','TRUCK','COVERED_VAN') NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('AVAILABLE','IN_USE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vehicles_registration_number (registration_number),
    KEY idx_vehicles_status (status)
);

CREATE TABLE IF NOT EXISTS routes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    origin_hub_id BIGINT UNSIGNED NOT NULL,
    destination_hub_id BIGINT UNSIGNED NOT NULL,
    distance_km DECIMAL(10,2) NULL,
    estimated_minutes INT UNSIGNED NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_routes_code (code),
    KEY idx_routes_origin_hub (origin_hub_id),
    KEY idx_routes_destination_hub (destination_hub_id),
    KEY idx_routes_status (status),
    CONSTRAINT fk_routes_origin_hub
        FOREIGN KEY (origin_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_routes_destination_hub
        FOREIGN KEY (destination_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS route_stops (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    route_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    sequence_no INT UNSIGNED NOT NULL,
    estimated_arrival_minutes INT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_route_stops_sequence (route_id, sequence_no),
    UNIQUE KEY uq_route_stops_hub (route_id, hub_id),
    KEY idx_route_stops_hub_id (hub_id),
    CONSTRAINT fk_route_stops_route
        FOREIGN KEY (route_id) REFERENCES routes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_route_stops_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Riders
-- ============================================================

CREATE TABLE IF NOT EXISTS riders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    license_number VARCHAR(100) NULL,
    -- How the company pays the rider (ops/payroll; COD cash still goes to company)
    compensation_type ENUM('SALARIED','CONTRACTUAL','COMMISSION','MIXED')
        NOT NULL DEFAULT 'SALARIED',
    status ENUM('AVAILABLE','BUSY','OFFLINE','SUSPENDED') NOT NULL DEFAULT 'OFFLINE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_riders_user_id (user_id),
    UNIQUE KEY uq_riders_employee_code (employee_code),
    KEY idx_riders_hub_id (hub_id),
    KEY idx_riders_status (status),
    CONSTRAINT fk_riders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_riders_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Rider applications
-- ============================================================

CREATE TABLE IF NOT EXISTS rider_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255) NULL,
    district VARCHAR(100) NOT NULL,
    vehicle_type ENUM('BICYCLE','MOTORCYCLE','CAR','VAN','OTHER') NOT NULL,
    license_number VARCHAR(100) NULL,
    experience_years DECIMAL(4,1) NULL,
    availability VARCHAR(100) NOT NULL,
    notes VARCHAR(1000) NULL,
    status ENUM('PENDING','REVIEWING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rider_applications_status_created (status, created_at),
    KEY idx_rider_applications_phone (phone)
);

CREATE TABLE IF NOT EXISTS rider_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rider_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    recorded_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_rider_locations_rider_time (rider_id, recorded_at),
    CONSTRAINT fk_rider_locations_rider
        FOREIGN KEY (rider_id) REFERENCES riders(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Parcels
-- ============================================================

CREATE TABLE IF NOT EXISTS parcels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tracking_number VARCHAR(50) NOT NULL,
    sender_customer_id BIGINT UNSIGNED NOT NULL,
    -- The receiver may or may not be a DropX account holder.
    receiver_customer_id BIGINT UNSIGNED NULL,
    receiver_name VARCHAR(150) NOT NULL,
    receiver_phone VARCHAR(30) NOT NULL,
    receiver_secondary_phone VARCHAR(30) NULL,
    origin_hub_id BIGINT UNSIGNED NOT NULL,
    destination_hub_id BIGINT UNSIGNED NOT NULL,
    current_hub_id BIGINT UNSIGNED NULL,
    weight DECIMAL(10,2) NOT NULL,
    length DECIMAL(10,2) NULL,
    width DECIMAL(10,2) NULL,
    height DECIMAL(10,2) NULL,
    parcel_type ENUM('DOCUMENT','PACKAGE','FRAGILE','OTHER') NOT NULL DEFAULT 'PACKAGE',
    payment_type ENUM('PREPAID','COD') NOT NULL DEFAULT 'PREPAID',
    cod_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM(
        'CREATED',
        'PICKED_UP',
        'IN_TRANSIT',
        'AT_HUB',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'FAILED',
        'CANCELLED',
        'RETURNED'
    ) NOT NULL DEFAULT 'CREATED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_parcels_tracking_number (tracking_number),
    KEY idx_parcels_sender (sender_customer_id),
    KEY idx_parcels_receiver (receiver_customer_id),
    KEY idx_parcels_origin_hub (origin_hub_id),
    KEY idx_parcels_destination_hub (destination_hub_id),
    KEY idx_parcels_current_hub (current_hub_id),
    KEY idx_parcels_status (status),
    KEY idx_parcels_created_at (created_at),
    CONSTRAINT fk_parcels_sender
        FOREIGN KEY (sender_customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_parcels_receiver
        FOREIGN KEY (receiver_customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_parcels_origin_hub
        FOREIGN KEY (origin_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_parcels_destination_hub
        FOREIGN KEY (destination_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_parcels_current_hub
        FOREIGN KEY (current_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS parcel_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_parcel_items_parcel_id (parcel_id),
    CONSTRAINT fk_parcel_items_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- One pickup address and one delivery address per parcel, selected from the
-- city -> zone -> area hierarchy.
--
-- The `*_name` columns are snapshots: an administrator renaming a zone must not
-- rewrite what a parcel said the day it was booked. Every read of a historical
-- parcel therefore comes from here, not from a join back to `service_*`.
CREATE TABLE IF NOT EXISTS parcel_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    type ENUM('PICKUP','DELIVERY') NOT NULL,
    city_id BIGINT UNSIGNED NOT NULL,
    zone_id BIGINT UNSIGNED NOT NULL,
    area_id BIGINT UNSIGNED NULL,
    city_name VARCHAR(100) NOT NULL,
    zone_name VARCHAR(100) NOT NULL,
    area_name VARCHAR(100) NULL,
    address_line VARCHAR(300) NOT NULL,
    landmark VARCHAR(255) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_parcel_addresses_parcel_type (parcel_id, type),
    KEY idx_parcel_addresses_city (city_id),
    KEY idx_parcel_addresses_zone (zone_id),
    KEY idx_parcel_addresses_area (area_id),
    CONSTRAINT fk_parcel_addresses_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_parcel_addresses_city
        FOREIGN KEY (city_id) REFERENCES service_cities(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_parcel_addresses_zone
        FOREIGN KEY (zone_id) REFERENCES service_zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_parcel_addresses_area
        FOREIGN KEY (area_id) REFERENCES service_areas(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- A customer's in-progress booking, saved while they fill the form.
--
-- Deliberately NOT a `parcels` row: a half-filled booking cannot satisfy the
-- NOT NULL columns (`tracking_number`, `weight`, both hubs, the receiver), and
-- every `parcels` row is visible in the customer's parcel list — a draft must
-- not look like a booked shipment. `payload` stores the booking form's raw
-- values as JSON (strings, exactly as typed), so restoring is a direct form
-- reset with no translation; the real `createParcelSchema` still validates the
-- full set at booking time.
--
-- One draft per customer: `customer_id` is UNIQUE and the write is an upsert,
-- so autosave can never fan out into a list of half-finished bookings.
CREATE TABLE IF NOT EXISTS parcel_drafts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    payload JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_parcel_drafts_customer (customer_id),
    CONSTRAINT fk_parcel_drafts_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Pickups
-- ============================================================

CREATE TABLE IF NOT EXISTS pickups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NULL,
    assigned_rider_id BIGINT UNSIGNED NULL,
    pickup_address VARCHAR(500) NOT NULL,
    scheduled_at DATETIME NULL,
    picked_up_at DATETIME NULL,
    status ENUM('REQUESTED','ASSIGNED','IN_PROGRESS','PICKED_UP','FAILED','CANCELLED')
        NOT NULL DEFAULT 'REQUESTED',
    failure_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pickups_parcel_id (parcel_id),
    KEY idx_pickups_requested_by (requested_by),
    KEY idx_pickups_rider (assigned_rider_id),
    KEY idx_pickups_status (status),
    CONSTRAINT fk_pickups_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pickups_requested_by
        FOREIGN KEY (requested_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pickups_rider
        FOREIGN KEY (assigned_rider_id) REFERENCES riders(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ============================================================
-- Transfers
-- ============================================================

CREATE TABLE IF NOT EXISTS transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transfer_number VARCHAR(50) NOT NULL,
    from_hub_id BIGINT UNSIGNED NOT NULL,
    to_hub_id BIGINT UNSIGNED NOT NULL,
    route_id BIGINT UNSIGNED NULL,
    vehicle_id BIGINT UNSIGNED NULL,
    driver_id BIGINT UNSIGNED NULL,
    status ENUM('PLANNED','LOADING','IN_TRANSIT','ARRIVED','CANCELLED')
        NOT NULL DEFAULT 'PLANNED',
    departed_at DATETIME NULL,
    arrived_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_transfers_number (transfer_number),
    KEY idx_transfers_from_hub (from_hub_id),
    KEY idx_transfers_to_hub (to_hub_id),
    KEY idx_transfers_route (route_id),
    KEY idx_transfers_vehicle (vehicle_id),
    KEY idx_transfers_driver (driver_id),
    KEY idx_transfers_status (status),
    CONSTRAINT fk_transfers_from_hub
        FOREIGN KEY (from_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_transfers_to_hub
        FOREIGN KEY (to_hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_transfers_route
        FOREIGN KEY (route_id) REFERENCES routes(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_transfers_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_transfers_driver
        FOREIGN KEY (driver_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transfer_parcels (
    transfer_id BIGINT UNSIGNED NOT NULL,
    parcel_id BIGINT UNSIGNED NOT NULL,
    loaded_at DATETIME NULL,
    unloaded_at DATETIME NULL,
    PRIMARY KEY (transfer_id, parcel_id),
    KEY idx_transfer_parcels_parcel_id (parcel_id),
    CONSTRAINT fk_transfer_parcels_transfer
        FOREIGN KEY (transfer_id) REFERENCES transfers(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_transfer_parcels_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Deliveries
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    rider_id BIGINT UNSIGNED NOT NULL,
    -- Multiple rows per parcel allowed (retry after FAILED/CANCELLED)
    attempt_no INT UNSIGNED NOT NULL DEFAULT 1,
    delivery_address VARCHAR(500) NOT NULL,
    assigned_at DATETIME NULL,
    out_for_delivery_at DATETIME NULL,
    delivered_at DATETIME NULL,
    status ENUM('ASSIGNED','OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED','RETURNED')
        NOT NULL DEFAULT 'ASSIGNED',
    failure_reason VARCHAR(500) NULL,
    recipient_name VARCHAR(150) NULL,
    recipient_phone VARCHAR(30) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_deliveries_parcel_attempt (parcel_id, attempt_no),
    KEY idx_deliveries_parcel_id (parcel_id),
    KEY idx_deliveries_hub_id (hub_id),
    KEY idx_deliveries_rider_id (rider_id),
    KEY idx_deliveries_status (status),
    CONSTRAINT fk_deliveries_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_deliveries_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_deliveries_rider
        FOREIGN KEY (rider_id) REFERENCES riders(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS delivery_proofs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT UNSIGNED NOT NULL,
    type ENUM('SIGNATURE','PHOTO','OTP','IDENTITY') NOT NULL,
    value VARCHAR(500) NULL,
    file_url VARCHAR(500) NULL,
    verified_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_delivery_proofs_delivery_id (delivery_id),
    CONSTRAINT fk_delivery_proofs_delivery
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Parcel Events / Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS parcel_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM(
        'CREATED',
        'PICKED_UP',
        'ARRIVED_HUB',
        'DEPARTED_HUB',
        'LOADED',
        'UNLOADED',
        'ASSIGNED_RIDER',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'FAILED',
        'RETURNED'
    ) NOT NULL,
    hub_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    rider_id BIGINT UNSIGNED NULL,
    description VARCHAR(500) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_parcel_events_parcel_time (parcel_id, created_at),
    KEY idx_parcel_events_hub_id (hub_id),
    KEY idx_parcel_events_user_id (user_id),
    KEY idx_parcel_events_rider_id (rider_id),
    CONSTRAINT fk_parcel_events_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_parcel_events_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_parcel_events_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_parcel_events_rider
        FOREIGN KEY (rider_id) REFERENCES riders(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ============================================================
-- Payments & Settlements
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    type ENUM('DELIVERY_FEE','COD','REFUND','OTHER') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method ENUM('CASH','BKASH','NAGAD','CARD','BANK','ONLINE') NOT NULL,
    status ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payments_parcel_id (parcel_id),
    KEY idx_payments_type_status (type, status),
    KEY idx_payments_paid_at (paid_at),
    CONSTRAINT fk_payments_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS settlements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- Server-assigned reference (`SET-0001`), same contract as `customers.code`.
    code VARCHAR(20) NOT NULL DEFAULT '',
    customer_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_cod DECIMAL(14,2) NOT NULL DEFAULT 0,
    delivery_charges DECIMAL(14,2) NOT NULL DEFAULT 0,
    other_charges DECIMAL(14,2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    status ENUM('PENDING','PROCESSING','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_settlements_code (code),
    KEY idx_settlements_customer_id (customer_id),
    KEY idx_settlements_period (period_start, period_end),
    KEY idx_settlements_status (status),
    CONSTRAINT fk_settlements_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- Notifications & Support
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    customer_id BIGINT UNSIGNED NULL,
    parcel_id BIGINT UNSIGNED NULL,
    channel ENUM('SMS','EMAIL','PUSH') NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user_id (user_id),
    KEY idx_notifications_customer_id (customer_id),
    KEY idx_notifications_parcel_id (parcel_id),
    KEY idx_notifications_status (status),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_notifications_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_notifications_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    parcel_id BIGINT UNSIGNED NULL,
    assigned_to BIGINT UNSIGNED NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
    status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_support_tickets_customer (customer_id),
    KEY idx_support_tickets_parcel (parcel_id),
    KEY idx_support_tickets_assigned_to (assigned_to),
    KEY idx_support_tickets_status_priority (status, priority),
    CONSTRAINT fk_support_tickets_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_support_tickets_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_support_tickets_assigned_to
        FOREIGN KEY (assigned_to) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ============================================================
-- Audit
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT UNSIGNED NULL,
    old_data JSON NULL,
    new_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_logs_user_id (user_id),
    KEY idx_audit_logs_entity (entity_type, entity_id),
    KEY idx_audit_logs_created_at (created_at),
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

-- ============================================================
-- Sequences
-- ============================================================

-- MySQL has no sequences, so every server-assigned code (`RDR-`, `CUS-`,
-- `SET-`) claims a number from a one-row counter here. The claim is a single
-- atomic `INSERT ... ON DUPLICATE KEY UPDATE next_value =
-- LAST_INSERT_ID(next_value + 1)`, which serialises concurrent writers on the
-- row lock and returns the new value in the same round trip — see
-- `shared/ids/sequence.ts`. Pass the caller's transaction handle when there is
-- one, so a rolled-back insert also rolls its number back.
--
-- The column is `next_value`, never `last_value`: that is reserved in MySQL 8.
CREATE TABLE IF NOT EXISTS sequences (
    seq_name VARCHAR(50) NOT NULL,
    next_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (seq_name)
);

-- ============================================================
-- Upgrades to tables above
-- ============================================================

-- MySQL has no `ADD COLUMN IF NOT EXISTS`, so these statements re-run on every
-- migrate. `migrate.ts` treats errno 1060 (duplicate column) and 1061
-- (duplicate key) as "already applied" — the same no-op `IF NOT EXISTS` gives
-- the CREATE TABLE statements — and fails on anything else.
--
-- Order is load-bearing: add the column, backfill it, and only then add the
-- unique key. Backfilled rows would otherwise all hold '' and the key would
-- reject them. Each step is its own statement so that a partially-applied state
-- still converges rather than aborting before its later steps.
ALTER TABLE customers ADD COLUMN code VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE settlements ADD COLUMN code VARCHAR(20) NOT NULL DEFAULT '';
-- Layout of the customer profile (avatar). Idempotent: errno 1060 from
-- `migrate.ts` means the column already exists, exactly like the code column.
ALTER TABLE customers ADD COLUMN avatar_url VARCHAR(500) NULL;

-- Heal a `code` column that already exists but with the wrong shape (an earlier
-- run added it nullable, which would let a NULL reach the mapper). Re-declaring
-- a matching definition is a no-op, so unlike `ADD COLUMN` this needs no errno
-- tolerance; and it runs before the backfill, which is scoped to `code = ''`
-- and would otherwise miss the NULLs this converts.
ALTER TABLE customers MODIFY COLUMN code VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE settlements MODIFY COLUMN code VARCHAR(20) NOT NULL DEFAULT '';

-- Existing rows get the first free numbers, in `id` order. Scoped to `code =
-- ''` so a re-run after a partial backfill never rewrites an assigned code —
-- and if that partial state means two rows would want the same number, the
-- unique key below rejects it loudly instead of shipping a duplicate.
UPDATE customers c
  JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM customers
    WHERE code = ''
  ) x ON x.id = c.id
  SET c.code = CONCAT('CUS-', LPAD(x.rn, 4, '0'));

UPDATE settlements s
  JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM settlements
    WHERE code = ''
  ) x ON x.id = s.id
  SET s.code = CONCAT('SET-', LPAD(x.rn, 4, '0'));

ALTER TABLE customers ADD UNIQUE KEY uq_customers_code (code);
ALTER TABLE settlements ADD UNIQUE KEY uq_settlements_code (code);

-- Seed the counters, then pin them above every number already in use — a
-- hand-inserted rider, or a database restored from before this migration — so
-- the next generated code cannot collide. `GREATEST` keeps this safe to re-run:
-- it raises a counter, never lowers it.
INSERT IGNORE INTO sequences (seq_name, next_value) VALUES
    ('rider', 0),
    ('customer', 0),
    ('settlement', 0);

UPDATE sequences s
  LEFT JOIN (
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(employee_code, '-', -1) AS UNSIGNED)), 0) AS max_code
    FROM riders
    WHERE employee_code REGEXP '^RDR-[0-9]+$'
  ) r ON 1 = 1
  SET s.next_value = GREATEST(s.next_value, r.max_code)
  WHERE s.seq_name = 'rider';

UPDATE sequences s
  LEFT JOIN (
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)), 0) AS max_code
    FROM customers
    WHERE code REGEXP '^CUS-[0-9]+$'
  ) c ON 1 = 1
  SET s.next_value = GREATEST(s.next_value, c.max_code)
  WHERE s.seq_name = 'customer';

UPDATE sequences s
  LEFT JOIN (
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)), 0) AS max_code
    FROM settlements
    WHERE code REGEXP '^SET-[0-9]+$'
  ) t ON 1 = 1
  SET s.next_value = GREATEST(s.next_value, t.max_code)
  WHERE s.seq_name = 'settlement';

SET FOREIGN_KEY_CHECKS = 1;
