# SOUTHEAST UNIVERSITY

**CSE384 - Database Design Lab**  
**PROJECT SQL QUERIES SUBMISSION**

*Do not rename, remove or reorder the section headings below. Replace the bracketed placeholders only. Submission is evaluated automatically and then reviewed.*

## Section 1: Student Information

| Field | Details |
|---|---|
| Student Name | [ your full name ] |
| Student ID | [ your ID ] |
| Section | [ section ] |
| Group ID | [ group number, or `Individual` ] |
| Project Title | DropX - Parcel Delivery & Logistics Management System |
| DBMS Used | MySQL 8.0+ |

## Section 2: Peer Review and Contribution

List every member of your group (including yourself) and the percentage of total project work each member contributed. The total must equal 100%. Every member submits this table independently, so answers are cross-checked.

| Member Name | Student ID | Work Done (1 line) | Contribution % |
|---|---|---|---:|
| [ name ] | [ ID ] | [ e.g. designed schema, wrote report queries ] | [ % ] |
| [ name ] | [ ID ] | [ ... ] | [ % ] |
| [ name ] | [ ID ] | [ ... ] | [ % ] |
| [ name ] | [ ID ] | [ ... ] | [ % ] |
| **TOTAL** | | | **100%** |

**Peer comment (2-3 lines, honest feedback on the teamwork, including any issue you faced):**

[ write here ]

**Self-declaration: I confirm the information above is accurate and the queries below are from our own project.**

## Section 3: Database Schema

Paste the complete CREATE TABLE statements (with all constraints) and sample INSERT statements, so the queries below can be re-run exactly as written.

### Complete CREATE TABLE statements

```sql
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
);

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
    UNIQUE KEY uq_branches_code (code)
);

CREATE TABLE IF NOT EXISTS hubs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    branch_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
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
    CONSTRAINT fk_hubs_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS hub_services (
    hub_id BIGINT UNSIGNED NOT NULL,
    service ENUM('PICKUP','SORTING','DELIVERY') NOT NULL,
    PRIMARY KEY (hub_id, service),
    CONSTRAINT fk_hub_services_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE CASCADE
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
    avatar_url VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
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
    CONSTRAINT fk_user_hubs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_user_hubs_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(20) NOT NULL DEFAULT '',
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255) NULL,
    type ENUM('INDIVIDUAL','BUSINESS') NOT NULL DEFAULT 'INDIVIDUAL',
    status ENUM('TEMP','ACTIVE') NOT NULL DEFAULT 'TEMP',
    avatar_url VARCHAR(500) NULL,
    consent_accepted_at DATETIME NULL,
    activated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_code (code),
    UNIQUE KEY uq_customers_phone (phone),
    UNIQUE KEY uq_customers_email (email)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(50) NULL,
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

CREATE TABLE IF NOT EXISTS service_cities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    service_type ENUM('ISD','SUBURB','OSD') NOT NULL DEFAULT 'ISD',
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_cities_code (code)
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
    UNIQUE KEY uq_service_zones_city_code (city_id, code),
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
    CONSTRAINT fk_service_areas_zone
        FOREIGN KEY (zone_id) REFERENCES service_zones(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pricing_lanes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pickup_type ENUM('ISD','SUBURB','OSD','ISD_ON_DEMAND') NOT NULL,
    delivery_type ENUM('ISD','SUBURB','OSD','SAME_CITY','DIFFERENT_CITY','SAME_CITY_ON_DEMAND') NOT NULL,
    same_city TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pricing_lanes_route (pickup_type, delivery_type, same_city)
);

CREATE TABLE IF NOT EXISTS pricing_slabs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pricing_lane_id BIGINT UNSIGNED NOT NULL,
    min_weight_grams INT UNSIGNED NOT NULL,
    max_weight_grams INT UNSIGNED NOT NULL,
    base_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    extra_kg_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    cod_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    cod_fixed_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pricing_slabs_lane_min (pricing_lane_id, min_weight_grams),
    UNIQUE KEY uq_pricing_slabs_lane_max (pricing_lane_id, max_weight_grams),
    CONSTRAINT fk_pricing_slabs_lane
        FOREIGN KEY (pricing_lane_id) REFERENCES pricing_lanes(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_pricing_slabs_range
        CHECK (max_weight_grams > min_weight_grams)
);

CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    registration_number VARCHAR(50) NOT NULL,
    type ENUM('BIKE','VAN','TRUCK','COVERED_VAN') NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('AVAILABLE','IN_USE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vehicles_registration_number (registration_number)
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
    CONSTRAINT fk_route_stops_route
        FOREIGN KEY (route_id) REFERENCES routes(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_route_stops_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS riders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    license_number VARCHAR(100) NULL,
    compensation_type ENUM('SALARIED','CONTRACTUAL','COMMISSION','MIXED')
        NOT NULL DEFAULT 'SALARIED',
    status ENUM('AVAILABLE','BUSY','OFFLINE','SUSPENDED') NOT NULL DEFAULT 'OFFLINE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_riders_user_id (user_id),
    UNIQUE KEY uq_riders_employee_code (employee_code),
    CONSTRAINT fk_riders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_riders_hub
        FOREIGN KEY (hub_id) REFERENCES hubs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

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
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS rider_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rider_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    recorded_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_rider_locations_rider
        FOREIGN KEY (rider_id) REFERENCES riders(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parcels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tracking_number VARCHAR(50) NOT NULL,
    sender_customer_id BIGINT UNSIGNED NOT NULL,
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
    CONSTRAINT fk_parcel_items_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

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
    CONSTRAINT fk_transfer_parcels_transfer
        FOREIGN KEY (transfer_id) REFERENCES transfers(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_transfer_parcels_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parcel_id BIGINT UNSIGNED NOT NULL,
    hub_id BIGINT UNSIGNED NOT NULL,
    rider_id BIGINT UNSIGNED NOT NULL,
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
    CONSTRAINT fk_delivery_proofs_delivery
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

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
    CONSTRAINT fk_payments_parcel
        FOREIGN KEY (parcel_id) REFERENCES parcels(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS settlements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
    CONSTRAINT fk_settlements_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

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
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sequences (
    seq_name VARCHAR(50) NOT NULL,
    next_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (seq_name)
);

SET FOREIGN_KEY_CHECKS = 1;
```

### Sample INSERT statements

```sql
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
```

## Section 4: Project Queries

Use the exact block format below for every query. Queries are numbered continuously.

*Category must be one of: DDL / INSERT / UPDATE / DELETE / SELECT-Filter / ORDER BY / LIKE / IN-BETWEEN / TOP-LIMIT / JOIN / Aggregate-GROUP BY / Subquery / Other.*

### Query 1

| Field | Details |
|---|---|
| Category | Other |
| Purpose | Display the real MySQL definition of the pricing slab table so its primary key, unique keys, foreign key, and CHECK constraint can be verified. |

**SQL:**

```sql
SHOW CREATE TABLE pricing_slabs;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 1 output](images/revised/query-01-output.png)

### Query 2

| Field | Details |
|---|---|
| Category | INSERT |
| Purpose | Record a new rider application submitted through the DropX rider recruitment flow. |

**SQL:**

```sql
INSERT INTO rider_applications
    (name, phone, email, district, vehicle_type,
     license_number, experience_years, availability, notes)
VALUES
    ('Imran Kabir', '01600000001',
     'imran.rider@example.com', 'Dhaka', 'MOTORCYCLE',
     'DL-DHK-20002', 2.5, 'Full-time',
     'Available for morning and evening shifts');
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 2 output](images/revised/query-02-output.png)

### Query 3

| Field | Details |
|---|---|
| Category | UPDATE |
| Purpose | Activate a temporary customer after successful OTP verification and store the activation time. |

**SQL:**

```sql
UPDATE customers
SET status = 'ACTIVE',
    activated_at = CURRENT_TIMESTAMP
WHERE id = 4
  AND status = 'TEMP';
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 3 output](images/revised/query-03-output.png)

### Query 4

| Field | Details |
|---|---|
| Category | DELETE |
| Purpose | Delete a customer's saved booking draft after the booking is completed or intentionally discarded. |

**SQL:**

```sql
DELETE FROM parcel_drafts
WHERE customer_id = 1;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 4 output](images/revised/query-04-output.png)

### Query 5

| Field | Details |
|---|---|
| Category | SELECT-Filter |
| Purpose | Find the customer account matching the submitted phone number or email during OTP login. |

**SQL:**

```sql
SELECT id, name, phone, email, status
FROM customers
WHERE phone = '01900000001'
   OR email = 'ayesha@example.com'
LIMIT 1;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 5 output](images/revised/query-05-output.png)

### Query 6

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | Load the roles assigned to selected staff accounts and show each role name in alphabetical order. |

**SQL:**

```sql
SELECT ur.user_id, ur.role_id, r.name AS role_name
FROM user_roles AS ur
INNER JOIN roles AS r ON r.id = ur.role_id
WHERE ur.user_id IN (1, 2)
ORDER BY r.name ASC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 6 output](images/revised/query-06-output.png)

### Query 7

| Field | Details |
|---|---|
| Category | Subquery |
| Purpose | Return every active hub together with a JSON array of the operational services offered by that hub. |

**SQL:**

```sql
SELECT h.id, h.name, h.code, h.district, h.status,
       COALESCE(
           (
               SELECT JSON_ARRAYAGG(hs.service)
               FROM hub_services AS hs
               WHERE hs.hub_id = h.id
           ),
           JSON_ARRAY()
       ) AS services
FROM hubs AS h
WHERE h.status = 'ACTIVE'
ORDER BY h.id ASC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 7 output](images/revised/query-07-output.png)

### Query 8

| Field | Details |
|---|---|
| Category | LIKE |
| Purpose | Find customers whose names contain `Rahman` when staff know only part of the customer name. |

**SQL:**

```sql
SELECT c.code, c.name, c.phone, c.email, c.status
FROM customers AS c
WHERE c.name LIKE '%Rahman%'
ORDER BY c.name ASC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 8 output](images/revised/query-08-output.png)

### Query 9

| Field | Details |
|---|---|
| Category | IN-BETWEEN |
| Purpose | Find parcels in selected active statuses that were created during the submission's sample date range. |

**SQL:**

```sql
SELECT p.tracking_number, p.receiver_name, p.status,
       p.delivery_fee, p.created_at
FROM parcels AS p
WHERE p.status IN ('CREATED', 'AT_HUB', 'OUT_FOR_DELIVERY')
  AND p.created_at BETWEEN '2026-10-10 00:00:00'
                       AND '2026-10-14 23:59:59'
ORDER BY p.created_at DESC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 9 output](images/revised/query-09-output.png)

### Query 10

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | Build the public parcel-tracking summary from the parcel and its origin, destination, and current hubs. |

**SQL:**

```sql
SELECT p.tracking_number, p.parcel_type,
       p.payment_type, p.status, p.weight, p.cod_amount,
       origin.name AS origin_hub,
       destination.name AS destination_hub,
       current_hub.name AS current_hub
FROM parcels AS p
INNER JOIN hubs AS origin ON origin.id = p.origin_hub_id
INNER JOIN hubs AS destination
    ON destination.id = p.destination_hub_id
LEFT JOIN hubs AS current_hub
    ON current_hub.id = p.current_hub_id
WHERE p.tracking_number = 'DX-20261001-001'
LIMIT 1;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 10 output](images/revised/query-10-output.png)

### Query 11

| Field | Details |
|---|---|
| Category | ORDER BY |
| Purpose | Show a parcel's tracking history with the newest event first and its hub name when available. |

**SQL:**

```sql
SELECT e.event_type, e.description, e.created_at,
       h.name AS hub_name
FROM parcel_events AS e
LEFT JOIN hubs AS h ON h.id = e.hub_id
WHERE e.parcel_id = 1
ORDER BY e.created_at DESC, e.id DESC
LIMIT 100;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 11 output](images/revised/query-11-output.png)

### Query 12

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | List every parcel loaded into a transfer with its tracking number, parcel status, and loading timestamps. |

**SQL:**

```sql
SELECT tp.parcel_id, tp.loaded_at, tp.unloaded_at,
       p.tracking_number, p.status
FROM transfer_parcels AS tp
INNER JOIN parcels AS p ON p.id = tp.parcel_id
WHERE tp.transfer_id = 1
ORDER BY p.tracking_number;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 12 output](images/revised/query-12-output.png)

### Query 13

| Field | Details |
|---|---|
| Category | Aggregate-GROUP BY |
| Purpose | Count the parcels assigned to each selected transfer for the transfer-list summary. |

**SQL:**

```sql
SELECT transfer_id, COUNT(*) AS parcel_count
FROM transfer_parcels
WHERE transfer_id IN (1)
GROUP BY transfer_id;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 13 output](images/revised/query-13-output.png)

### Query 14

| Field | Details |
|---|---|
| Category | Aggregate-GROUP BY |
| Purpose | Calculate the next delivery-attempt number so retries never overwrite an earlier attempt. |

**SQL:**

```sql
SELECT parcel_id,
       COALESCE(MAX(attempt_no), 0) + 1 AS next_attempt_no
FROM deliveries
WHERE parcel_id IN (3, 4)
GROUP BY parcel_id
ORDER BY parcel_id;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 14 output](images/revised/query-14-output.png)

### Query 15

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | Show delivery attempts with parcel tracking information and the assigned rider's staff identity. |

**SQL:**

```sql
SELECT d.id AS delivery_id, d.attempt_no,
       d.status AS delivery_status,
       p.tracking_number,
       u.name AS rider_name,
       r.employee_code
FROM deliveries AS d
INNER JOIN parcels AS p ON p.id = d.parcel_id
INNER JOIN riders AS r ON r.id = d.rider_id
INNER JOIN users AS u ON u.id = r.user_id
ORDER BY d.created_at DESC, d.id DESC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 15 output](images/revised/query-15-output.png)

### Query 16

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | Combine payment records with parcel tracking numbers for finance and reconciliation work. |

**SQL:**

```sql
SELECT pay.id AS payment_id, par.tracking_number,
       pay.type, pay.amount, pay.method,
       pay.status, pay.paid_at
FROM payments AS pay
INNER JOIN parcels AS par ON par.id = pay.parcel_id
ORDER BY pay.created_at DESC, pay.id DESC;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 16 output](images/revised/query-16-output.png)

### Query 17

| Field | Details |
|---|---|
| Category | Aggregate-GROUP BY |
| Purpose | Calculate the total successfully paid amount for each payment type on a parcel. |

**SQL:**

```sql
SELECT parcel_id, type,
       COALESCE(SUM(amount), 0) AS total_paid
FROM payments
WHERE parcel_id IN (3, 4)
  AND status = 'PAID'
GROUP BY parcel_id, type
ORDER BY parcel_id, type;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 17 output](images/revised/query-17-output.png)

### Query 18

| Field | Details |
|---|---|
| Category | Aggregate-GROUP BY |
| Purpose | Calculate COD collections and delivery charges for a customer's settlement period. |

**SQL:**

```sql
SELECT par.sender_customer_id,
       COALESCE(
           SUM(CASE WHEN pay.type = 'COD' THEN pay.amount END),
           0
       ) AS total_cod,
       COALESCE(
           SUM(CASE WHEN pay.type = 'DELIVERY_FEE'
                    THEN pay.amount END),
           0
       ) AS delivery_charges
FROM payments AS pay
INNER JOIN parcels AS par ON par.id = pay.parcel_id
WHERE par.sender_customer_id = 3
  AND pay.status = 'PAID'
  AND pay.paid_at >= '2026-10-01'
  AND pay.paid_at < DATE_ADD('2026-10-31', INTERVAL 1 DAY)
GROUP BY par.sender_customer_id;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 18 output](images/revised/query-18-output.png)

### Query 19

| Field | Details |
|---|---|
| Category | JOIN |
| Purpose | Load the rider identity, assigned hub, employment status, and linked staff-account status used during rider authentication. |

**SQL:**

```sql
SELECT r.id AS rider_id, r.employee_code,
       r.compensation_type, r.status AS rider_status,
       u.name, u.email, u.status AS user_status,
       h.name AS hub_name
FROM riders AS r
INNER JOIN users AS u ON u.id = r.user_id
INNER JOIN hubs AS h ON h.id = r.hub_id
WHERE r.user_id = 2
LIMIT 1;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 19 output](images/revised/query-19-output.png)

### Query 20

| Field | Details |
|---|---|
| Category | TOP-LIMIT |
| Purpose | Display the five newest rider applications for the admin review queue. MySQL uses LIMIT instead of TOP. |

**SQL:**

```sql
SELECT id, name, phone, district, vehicle_type,
       status, created_at
FROM rider_applications
ORDER BY created_at DESC, id DESC
LIMIT 5;
```

**Output (paste a screenshot, or a text table for SELECT queries):**

![Query 20 output](images/revised/query-20-output.png)

## Notes

- This submission contains 20 complete, executable, non-duplicate queries selected from the real DropX repository patterns.
- The source query inventory contains 247 semicolon-terminated DML blocks: 155 `SELECT`, 39 `INSERT`, 43 `UPDATE`, and 10 `DELETE` blocks.
- The raw inventory spans these features: auth, tracking, customers, customer addresses, customer profile, roles, users, user profile, organization, locations, reference data, parcels, pickups, transfers, deliveries, routes, vehicles, pricing, payments, settlements, riders, rider applications, rider jobs, administration, and core authorization.
- Many raw statements contain application-only placeholders such as `?`, `${where}`, `${orderBy}`, and `${assignments}`. Those fragments are not copied as application code; the submitted versions replace them with reproducible MySQL values.
- Repeated statements, dynamically assembled fragments, count companions used only for pagination, and transaction-lock variants are documented in the source inventory but are not duplicated as separate screenshot items.
