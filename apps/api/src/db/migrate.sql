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
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255) NULL,
    type ENUM('INDIVIDUAL','BUSINESS') NOT NULL DEFAULT 'INDIVIDUAL',
    -- TEMP: created on OTP request after consent; ACTIVE: after OTP verified
    status ENUM('TEMP','ACTIVE') NOT NULL DEFAULT 'TEMP',
    consent_accepted_at DATETIME NULL,
    activated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_phone (phone),
    UNIQUE KEY uq_customers_email (email),
    KEY idx_customers_type (type),
    KEY idx_customers_status (status)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(50) NULL,
    address_line VARCHAR(500) NOT NULL,
    city VARCHAR(100) NULL,
    district VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customer_addresses_customer_id (customer_id),
    KEY idx_customer_addresses_location (district, city),
    CONSTRAINT fk_customer_addresses_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- ============================================================
-- Zones & Pricing
-- ============================================================

CREATE TABLE IF NOT EXISTS zones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_zones_code (code)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    origin_zone_id BIGINT UNSIGNED NOT NULL,
    destination_zone_id BIGINT UNSIGNED NOT NULL,
    min_weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_weight DECIMAL(10,2) NULL,
    base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    price_per_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
    cod_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    cod_fixed_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    express_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pricing_rules_origin_zone (origin_zone_id),
    KEY idx_pricing_rules_destination_zone (destination_zone_id),
    KEY idx_pricing_rules_status (status),
    CONSTRAINT fk_pricing_rules_origin_zone
        FOREIGN KEY (origin_zone_id) REFERENCES zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pricing_rules_destination_zone
        FOREIGN KEY (destination_zone_id) REFERENCES zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
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
    receiver_address VARCHAR(300) NULL,
    origin_hub_id BIGINT UNSIGNED NOT NULL,
    destination_hub_id BIGINT UNSIGNED NOT NULL,
    current_hub_id BIGINT UNSIGNED NULL,
    -- Pricing uses destination zone (matched against pricing_rules)
    destination_zone_id BIGINT UNSIGNED NOT NULL,
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
    KEY idx_parcels_destination_zone (destination_zone_id),
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
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_parcels_destination_zone
        FOREIGN KEY (destination_zone_id) REFERENCES zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
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

SET FOREIGN_KEY_CHECKS = 1;
