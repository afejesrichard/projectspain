# Spain expenses XML format, v1

Interchange format between Claude (creates entries from receipt photos or free text) and the Spain moving app (stores them, exports them by period for analysis).

## Design in one paragraph

Every file is one `<expenses>` container holding one or more `<receipt>` elements, so a single upload and a monthly export have identical shape. Each receipt keeps the printed line labels verbatim next to a normalized English name, carries a closed-list category and a recurring/one-off flag per line, and ends with a reconciliation check against the printed total. Anything inferred rather than read is marked with `source` and `confidence`, so later analysis knows what to trust.

## Container

```xml
<expenses version="1" currency="EUR" generated="2026-08-30" generator="claude">
  <period from="2026-08-01" to="2026-08-31"/>   <!-- export only -->
  <receipt ...>...</receipt>
</expenses>
```

## Receipt

| Element / attribute | Required | Notes |
|---|---|---|
| `@id` | yes | `YYYYMMDD-<merchant-slug>-<seq>`, e.g. `20260830-lidl-01`. Unique across the store. |
| `@source` | yes | `photo`, `text`, `manual` |
| `@confidence` | yes | `high`, `medium`, `low` for the record as a whole |
| `@currency` | no | only when different from the container |
| `merchant` | yes | `name` required; `legal-name`, `nif`, `address` (`street`, `postcode`, `city`), `@chain` when known |
| `datetime` | yes | ISO 8601 with offset. Date-only allowed with `precision="day"`. `@source`: `printed`, `photo-timestamp`, `user` |
| `reference` | no | `@type`: `receipt-number`, `invoice-number`, `sequence`, `booking-id`, `partner-reference`. Open set; the validator does not restrict it. |
| `payment` | no | `@method`: `card`, `cash`, `transfer`, `bizum`, `other`; `@card` (e.g. `Visa Debit`), `@last4`, `@detail` free text. Never store the full PAN. |
| `loyalty` | no | `@program`, `@used`, `@saving` (total printed loyalty saving) |
| `items` | yes | one or more `item` |
| `totals` | yes | `total` and `paid` required; `gross`, `discounts`, `by-vat`, `reconciliation` when derivable |
| `attachments` | no | `photo/@file` original filename |
| `notes` | no | free text |

## Item

| Element / attribute | Required | Notes |
|---|---|---|
| `@n` | yes | line number in printed order |
| `@category` | yes | closed list below |
| `@sub` | no | free lowercase slug (`dairy`, `canned`, `small-appliance`) |
| `@recurrence` | no | `recurring` (default) or `one-off` |
| `@vat` | no | letter as printed (Spain: A 4%, B 10%, C 21%). When the receipt prints rates but no letters, assign the letter from the printed IVA table and say so in `reconciliation`. |
| `label` | photo only | text exactly as printed, `@lang` `ca` or `es` |
| `name` | yes | normalized English, `@lang="en"` |
| `brand` | no | |
| `qty`, `unit-price` | when printed | `qty/@unit` (`kg`, `l`) for weighed or measured lines; `qty` then keeps the printed decimals (e.g. `0.350`), `unit-price` is the printed per-unit price, `gross` is the printed line amount. |
| `gross` | yes | qty times unit price, before discounts |
| `discounts/discount` | no | positive numbers; `@type`: `price-cut`, `lidl-plus`, `coupon`, `multibuy` |
| `net` | yes | gross minus discounts |

## Categories (closed list)

`food`, `alcohol`, `household`, `home-setup`, `kids`, `health`, `transport`, `eating-out`, `leisure`, `housing`, `admin`, `other`

`home-setup` is the relocation spike: appliances, furniture, tools, first-fit purchases. Keeping it separate from `household` (consumables) is what lets a later analysis split settling-in cost from monthly run-rate.

## Rules

- Amounts: decimal, dot separator, two places, no symbols.
- `net` = `gross` minus the sum of `discount`; `total` = sum of item `net`. The generator writes `<reconciliation status="ok|mismatch">` and states the difference when it does not add up (rounding lines happen).
- VAT letters are kept as printed. `by-vat/class` carries `@rate` (Spain: A 4%, B 10%, C 21%, confirmed on the Lidl slip). When the receipt prints an IVA table, `@base` and `@tax` hold the printed net and tax per class, the element value is the gross, and `by-vat/@source="printed"`; otherwise the generator computes the gross per class from item classes and sets `@source="computed"`.
- Inferred values carry `source` and, when not certain, `confidence`.
- Duplicate check on import: reject same `@id`; warn on same `nif` plus `receipt-number`.
- UTF-8 throughout.

## Free-text entry

Input: "Two coffees and two croissants at the bar on Marina, 7.40, cash, this morning."

```xml
<receipt id="20260830-bar-marina-01" source="text" confidence="medium">
  <merchant><name>Bar on Carrer de la Marina (name not given)</name></merchant>
  <datetime source="user" precision="day">2026-08-30</datetime>
  <payment method="cash"/>
  <items>
    <item n="1" category="eating-out" sub="cafe">
      <name lang="en">2 coffees, 2 croissants</name>
      <qty>1</qty>
      <gross>7.40</gross>
      <net>7.40</net>
    </item>
  </items>
  <totals><total>7.40</total><paid>7.40</paid></totals>
</receipt>
```

## What the app subpage needs to do

1. Import: parse, check `version="1"`, read `reconciliation`, reject duplicate ids, store each `<receipt>` element verbatim alongside indexed fields (id, datetime, merchant name, total, source).
2. List: receipts by date with merchant and total; tap to see lines.
3. Export: pick a date range, emit one `<expenses>` container with `<period>` and the stored receipt elements unchanged. No aggregation in the app; that is Claude's job on the way back.

## Photo tip

Capture the whole slip down to the barcode. On Lidl receipts the date, time, card type, last four digits and the IVA table all print below the contactless symbol, and they turn several inferred fields into printed ones.

## Changes

- 31 Aug 2026: added `reference/@type` values `booking-id` and `partner-reference` (booking confirmations); added `qty/@unit` for weighed lines; documented VAT letter assignment when a receipt prints rates without letters. All optional, no version bump; `version="1"` files stay valid.
