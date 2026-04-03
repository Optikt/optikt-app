# Optikt — App Functionality Prompt for Stitch

## What is Optikt?

**Optikt** is a management system for optical stores (ópticas) in Venezuela. It covers the full business workflow: patients/customers, optical prescriptions, product and lens inventory, sales with multi-currency payments, quotations, suppliers, and reporting. The entire interface is in **Spanish**.

**Users:** Optical store staff — sellers and admins who use this daily for customer service, sales, and inventory. They value speed and efficiency over aesthetics.

**Context:** Venezuelan optical retail. Multi-currency economy (USD, Bolívares, USDT), official BCV exchange rates, IVA tax, payment methods like Pago Móvil and Binance. WhatsApp and Instagram are primary business communication channels.

## 🎨 Paleta de colores:
- Azul marino (principal): #152346 — usado para fondos oscuros, textos y elementos de autoridad
- Amarillo dorado (acento): #f7cb16 — usado para destacar elementos clave, CTAs y detalles del ícono
- Azul cielo (secundario): #419ebd — usado para elementos secundarios, íconos y acentos frescos

## 🔤 Tipografía:
Familia: Unbounded (Google Fonts)
Usar en títulos, subtítulos y bloques de texto. Soporta múltiples pesos para crear jerarquía visual clara.

## 🖼️ Logo y variantes: Tengo disponibles los archivos individuales de todas las versiones del logo:
- Vertical (ícono arriba, nombre abajo)
- Horizontal (ícono a la izquierda, nombre a la derecha)
- Unicolor principal — azul marino #152346
- Unicolor amarillo — #f7cb16
- Unicolor secundario — azul cielo #419ebd
- Negativo — negro (para fondos claros)
- Positivo — blanco (para fondos oscuros, ideal sobre #152346)

---

## App Structure

The app has a **login page** (unauthenticated) and an **authenticated app zone** with persistent navigation.

### Navigation

All users see: Dashboard, Clientes, Inventario, Ventas, Presupuestos, Catálogo Lentes, Marcas, Materiales, Proveedores.

Admin-only: Reportes, Usuarios.

There's also a global search that lets users quickly find products and lenses from anywhere, and a user menu with settings and logout.

---

## Pages

### 1. Login

User authenticates with email/username and password. On success, redirects to the dashboard.

### 2. Dashboard

Quick overview of the store's state. Shows key stats: total customers, today's sales count, pending quotes, and items below minimum stock. Alerts the user about total pending payment balance across all sales. Shows recent sales activity and which items are running low on stock. Provides shortcuts to the most common actions: create a customer, add a product, start a new sale, or browse the lens catalog.

### 3. Customers List

Browse, search, create, edit, and soft-delete customers. Search works across name, phone, ID number (cédula), and email. Supports showing previously deleted customers and reactivating them. Creating a new customer navigates to their detail page. Customer data includes: names, Venezuelan ID document (V/E/J/G format), birthdate, primary and secondary phones, email, WhatsApp, address, and notes.

### 4. Customer Detail

Full customer profile. Shows all contact information and their current active prescription at a glance. Lists the complete prescription history — users can add new prescriptions, view past ones, and edit them. Prescriptions capture optical data for both eyes (OD/OS): sphere, cylinder, axis, and addition values, plus pupillary distance, doctor name, lens type recommendation, and notes. Validation enforces that sphere OR cylinder must be provided per eye, and axis is required when cylinder is present.

### 5. Products List (Inventario)

Browse and manage the physical product inventory: frames (armazones), sunglasses, contact lenses, and accessories. Filter by product type, brand, supplier, or search by name/SKU. Low-stock items are visually flagged. Supports soft delete and reactivation of previously deleted products.

### 6. Product Detail

View all information about a product: SKU, brand, supplier, material, color, size, gender. Shows purchase pricing with the original currency and its USD BCV equivalent, sale price, calculated margin, and tax status. Displays current stock level vs. minimum threshold. Users can view the full audit history of changes made to this product (who changed what and when), edit it, or delete it.

### 7. Product Create/Edit

Create or update a product. Key capabilities:
- Auto-generates SKU based on type + brand, but allows manual editing.
- Brand, supplier, and material can be selected from existing records OR created inline on the spot — the new entity is created in the same operation as the product.
- Multi-currency purchase pricing: user enters purchase price in any supported currency (USD BCV, USD parallel, VES, USDT), provides the exchange rate, and the system auto-calculates the normalized cost in USD.
- Tax toggle with configurable IVA rate (default 16%).
- Stock and minimum stock tracking.

### 8. Lens Catalog

Two sections in one page:

**Catalog tab:** Browse all lens offerings. Lenses come from two sources — TERMINADO (pre-fabricated, may be in stock) or LABORATORIO (custom-made by a lab for a specific prescription). Filter by source, lens type (monofocal, bifocal, progressive, occupational), or supplier. Each lens shows its optical traits (antireflejo, blue cut, photochromic), pricing, and stock status.

**Materials tab:** Manage lens materials (e.g., CR-39, policarbonato, trivex). Each material has a name, code, and refractive index. CRUD via modal.

### 9. Lens Detail

View full information about a lens catalog item: source, type, technology, supplier, material, optical characteristics (photochromic, blue cut, AR), and all defined optical ranges (sphere/cylinder/addition min/max bounds). Shows pricing breakdown: base price, sale price, mounting price, shipping price, whether priced per unit or per pair, and tax info. Displays inventory mode (tracked stock vs. on-demand), stock levels, and audit history.

### 10. Lens Create/Edit

Create or update a lens catalog entry. Define the source, type, technology, supplier and material (with inline creation). Toggle characteristics (photochromic, blue cut, AR). Set pricing (base, sale, mounting, shipping) and price type (unit/pair). Configure tax. Choose inventory mode (stock tracking or on-demand). Define one or more optical ranges with sphere/cylinder/addition bounds — addition ranges only apply for progressive and occupational lenses.

### 11. Sales List

Browse all sales. Filter by status (pendiente, completada, cancelada) or search. Each sale shows its order number, customer, date, total, paid amount, and status. Navigate to any sale's detail page.

### 12. New Sale (3-step wizard)

The most complex flow in the app. Creates a new sale through three steps:

**Step 1 — Customer:** Look up an existing customer by their ID number (cédula). If found, their info and latest prescription auto-load. If not found, create a new customer inline. Sales can also proceed without a customer for walk-in transactions.

**Step 2 — Items:** Build the order. Each line item is either a **Product** (selected from inventory with stock check) or a **Lens Pair** (selected from the lens catalog). For lens pairs, the user enters/confirms the prescription (OD/OS values) — auto-populated from the customer's latest prescription if available — selects the lens type, and picks optional treatments offered by that lens's supplier (e.g., antireflejo, blue cut, with their prices). Each item has a quantity, unit price (auto-filled, editable), optional per-item discount, and notes. Users can add as many items as needed with a running subtotal.

**Step 3 — Summary:** Review everything — customer, all items with treatments, subtotal, global discount (fixed or percentage), tax breakdown (IVA), and final total in USD. Confirm to create the sale.

On submission: the sale is created, product stock is decremented, an order number is generated, and the user is redirected to the sale detail page.

### 13. Sale Detail

Complete view of a sale: order info (number, customer, date, seller), all items with their details — for lenses, the prescription snapshot (OD/OS values) is shown, and for treatments, the selected treatments with prices. Shows totals with tax breakdown.

**Payment management** is the key feature here. Displays the balance: total owed, total paid (in USD BCV), and remaining amount. Lists all payments with their method, amount in native currency, USD BCV equivalent, exchange rate used, and reference number. Voided payments appear with distinct styling.

When there's a remaining balance, a payment form allows recording a new payment: choose from 6 methods (Pago Móvil, Transferencia, Punto de Venta, Efectivo Bs, Efectivo USD, Binance USDT), enter the amount in that currency, the exchange rate (auto-adjusted by method), the official BCV rate, and an optional reference. The USD BCV equivalent is auto-calculated. Payments can be voided individually, which recalculates the balance.

When fully paid, the sale auto-transitions to COMPLETADA status. Pending sales can be cancelled with a required reason.

### 14. Quotes List (Presupuestos)

Browse all quotations. Filter by status: borrador (draft), pendiente, convertido, expirado, cancelado. Shows quote number, customer (or "sin cliente" if none assigned), date, expiration date, total, and status.

### 15. New Quote (3-step wizard)

Nearly identical to the New Sale wizard with key differences: the customer is **optional** (quotes can exist without a customer), there's an expiration date ("válido hasta") field, no stock is decremented, and the quote starts in DRAFT status. Same 3-step flow: info → items → summary.

### 16. Quote Detail

View a quote's full information: customer, items, treatments, totals with tax breakdown, and notes. Key actions depend on the quote's state:
- **Convert to sale:** Turns the quote into an actual sale (available for draft/pending quotes).
- **Cancel:** Cancels the quote.
- **Assign customer:** For draft quotes without a customer — look up by ID number and assign.

### 17. Brands

Simple CRUD for product brands/manufacturers. Search, create, edit, soft-delete, and reactivate. Each brand has a name, description, country, and website.

### 18. Materials

CRUD for product materials (e.g., titanio, acetato, acero). Each material has a name, code, and is tied to a product type (frame, lens, accessory). Filter by product type. Supports soft delete and reactivation.

### 19. Suppliers (Proveedores)

Manage product distributors and lens laboratories. Each supplier has a type (distribuidor, laboratorio, or both), Venezuelan RIF (tax ID with check digit), and full contact info including phone, WhatsApp, email, Instagram, website, city, and address.

**For laboratory-type suppliers**, there's an additional capability: managing the lens treatments they offer. Each treatment has a name, category (antireflejo or blue cut), base and sale prices, and tax configuration. Treatments are what get offered as add-ons when selling lenses from that supplier.

### 20. Reports Hub

Navigation page to the three available reports: sales, payments, and inventory. Admin-only access.

### 21. Sales Report

Analyze sales within a date range (defaults to current month). Shows summary metrics: count, total revenue, total collected. Lists all sales in the period with their details. Can export to CSV or print.

### 22. Payments Report

Track all payments within a date range. Shows total count, total amount, and a breakdown by payment method (how much came in via Pago Móvil vs. Transferencia vs. cash vs. USDT, etc.). Lists every payment with its associated sale. Exportable and printable.

### 23. Inventory Report

Overview of stock status. Summarizes total tracked items, how many are in stock, total units, and out-of-stock count. Separates items into two groups: stock-tracked items (with current vs. minimum levels) and on-demand items (ordered per sale, no stock tracking). Exportable and printable.

### 24. Users

Admin-only user management. Create, edit, and deactivate system users. Each user has a full name, email, username, password, and role (SUPERADMIN, ADMIN, or VIEWER). Filter by role or include inactive users. Supports toggling active/inactive status and reactivating deactivated users.

### 25. Settings (Configuración)

Two sections: **profile settings** (available to all users — edit name, email, change password) and **business settings** (admin-only — store name, address, RIF, tax and currency defaults).

### 26. Error Page

Handles 404, 403, and 500 errors with Spanish messages and a link back to the dashboard.

---

## Key Business Rules

- **Multi-currency:** All prices are stored in USD BCV. Payments can be in Bolívares, USD cash, or USDT, each with their exchange rate. Everything normalizes to USD BCV for accounting.
- **6 payment methods:** Pago Móvil (Bs), Transferencia (Bs), Punto de Venta/POS (Bs), Efectivo Bs, Efectivo USD, Binance USDT.
- **Tax:** IVA at 16% default, configurable per product/lens. Tax breakdowns shown on sales and quotes.
- **Soft deletion everywhere:** Records are never hard-deleted, just marked as deleted. They can be shown via toggle and reactivated if needed.
- **Reactivation:** When creating a record that matches a deleted one (same SKU, ID number, or RIF), the system offers to reactivate it instead.
- **Audit trail:** Every change to a record is logged with who, when, and before/after values. Viewable on detail pages.
- **Roles:** SUPERADMIN and ADMIN can access reports, users, and all management. VIEWER has limited write access.
- **Venezuelan ID formats:** Cédula (V/E/J/G + number), RIF (with module-11 check digit).
- **Prescription validation:** Standard optical rules — sphere or cylinder required, axis required with cylinder, values in 0.25 diopter steps.
- **Quote → Sale conversion:** Quotes can be converted into actual sales in one action.
- **Stock management:** Products track stock with minimum thresholds and low-stock alerts. Lenses can be stock-tracked or on-demand. Sales decrement stock on creation.

---

## Data Model Overview

```
Users ──── Sessions
  ├── Sales ──── SaleItems (Product | Lens Pair | Treatment) + SalePayments → Customer
  ├── Quotes ── QuoteItems (same structure) → Customer (optional)
  └── ChangeHistory (audit log)

Customers ── Prescriptions (multiple, one current)

Products ── Brand + Supplier + Material
LensCatalogItems ── Supplier (+ their Treatments) + LensMaterial + OpticalRanges

Brands, Materials, Suppliers (standalone CRUD entities)
Suppliers ── SupplierTreatments (AR, Blue Cut)
```

---

## Screen Summary

| # | Page | Purpose |
|---|------|---------|
| 1 | Login | Authentication |
| 2 | Dashboard | Store overview + quick actions |
| 3 | Customers List | Customer CRUD |
| 4 | Customer Detail | Profile + prescriptions |
| 5 | Products List | Product inventory CRUD |
| 6 | Product Detail | Product info + pricing + stock |
| 7 | Product Create/Edit | Multi-currency product form |
| 8 | Lens Catalog | Lens items + materials management |
| 9 | Lens Detail | Lens info + optical ranges + pricing |
| 10 | Lens Create/Edit | Lens form with optical ranges |
| 11 | Sales List | Sales browsing |
| 12 | New Sale | 3-step wizard: customer → items → confirm |
| 13 | Sale Detail | Sale info + payment management |
| 14 | Quotes List | Quotes browsing |
| 15 | New Quote | 3-step wizard (customer optional) |
| 16 | Quote Detail | Quote info + convert to sale |
| 17 | Brands | Brand CRUD |
| 18 | Materials | Material CRUD |
| 19 | Suppliers | Supplier CRUD + treatment management |
| 20 | Reports Hub | Report navigation |
| 21 | Sales Report | Sales analysis by date range |
| 22 | Payments Report | Payment tracking by method |
| 23 | Inventory Report | Stock status overview |
| 24 | Users | User + role management |
| 25 | Settings | Profile + business config |
| 26 | Error Page | Error handling |
