# Table: `business`

[← Back to Overview](./README.md)

Represents an **external business partner** — either a raw material supplier (Chemicals, Raw Cotton) or a finished goods buyer (Export). Internal-only warehouses (Spinning, Knitting, Weaving, Dyeing, Garment Assembly) do not have a linked business.

---

## DDL

```sql
CREATE TABLE business (
    business_id            VARCHAR(10)  PRIMARY KEY,
    object_category_major  VARCHAR(150) NOT NULL,
    region                 VARCHAR(100) NOT NULL,
    coordinates            VARCHAR(50)  NOT NULL
);
```

---

## Columns

| Column | Type | Constraints | Description |
|---|---|---|---|
| `business_id` | `VARCHAR(10)` | **PK** | Format `BIZ-X0N` — X = process letter, N = sequence |
| `object_category_major` | `VARCHAR(150)` | NOT NULL | The specific stock/product this business provides or receives |
| `region` | `VARCHAR(100)` | NOT NULL | City where the business is located |
| `coordinates` | `VARCHAR(50)` | NOT NULL | Geographic coordinates `{lat}N {lng}E` |

---

## Seed Data (24 rows — 3 per process)

| business_id | object_category_major | region | process |
|---|---|---|---|
| BIZ-C01 | Reactive Dye Batch A | Karachi | Chemicals |
| BIZ-C02 | Solvents Grade 2 | Lahore | Chemicals |
| BIZ-C03 | Industrial Bleach | Faisalabad | Chemicals |
| BIZ-R01 | Premium Cotton Bale | Karachi | Raw Cotton |
| BIZ-R02 | Bajra Grain Stock | Lahore | Raw Cotton |
| BIZ-R03 | Raw Lint Bundle | Multan | Raw Cotton |
| BIZ-S01 | Ring Spun 20s | Faisalabad | Spinning |
| BIZ-S02 | Combed Yarn 40s | Karachi | Spinning |
| BIZ-S03 | Blended Rotor Yarn | Lahore | Spinning |
| BIZ-K01 | Single Jersey Roll | Karachi | Knitting |
| BIZ-K02 | Rib 2x2 Panel | Lahore | Knitting |
| BIZ-K03 | Fleece Inner Lining | Sialkot | Knitting |
| BIZ-W01 | Plain Weave Roll | Faisalabad | Weaving |
| BIZ-W02 | Denim Warp Sheet | Lahore | Weaving |
| BIZ-W03 | Canvas Heavy Roll | Multan | Weaving |
| BIZ-D01 | Reactive Red Lot | Karachi | Dyeing |
| BIZ-D02 | Indigo Denim Batch | Faisalabad | Dyeing |
| BIZ-D03 | Pigment Print Stock | Lahore | Dyeing |
| BIZ-G01 | Formal Shirt Lot A | Karachi | Garment Assembly |
| BIZ-G02 | Denim Trouser Pack | Lahore | Garment Assembly |
| BIZ-G03 | Kids Garment Set | Sialkot | Garment Assembly |
| BIZ-E01 | USA Bound Carton | Karachi | Export |
| BIZ-E02 | EU Finished Bundle | Lahore | Export |
| BIZ-E03 | Holding Export Lot | Sialkot | Export |

---

## Business Link Types

The SQL schema records link type on the [`warehouse`](./warehouse.md) table:

| Value | Applies To |
|---|---|
| `Supplier` | Warehouses receiving inbound raw materials |
| `Customer` | Warehouses delivering outbound finished goods |

In the application JSON, `business_link_type` uses richer values: `Direct Supply`, `3PL`, `Franchise`, `Joint Venture`, `Subsidiary`, `Partner`.

---

## Indexes

```sql
CREATE INDEX idx_wh_business ON warehouse (business_id);
```

*(Index lives on the referencing table)*

---

## Relationships

| Direction | Related Table | Via | Cardinality |
|---|---|---|---|
| One business → many warehouses | [warehouse](./warehouse.md) | `warehouse.business_id` | 1 : N |

---

## Application Layer Mapping

`business` corresponds to the `businessLinkType` + geography fields in [`warehouse-relationships.json`](./app-layer.md#warehouse-relationshipsjson). There is no standalone business JSON file — the data is embedded in the warehouse relationship record. See [app-layer.md](./app-layer.md).
