# PriceTracker Scraping Process

## Product Scraping and Matching Flow

```mermaid
flowchart TD
    A[Start Scraping] --> B[Scraper runs and collects product data]
    B --> C[Store data in scraped_products table]
    C --> D{Match with existing product?}
    D -->|Yes, by EAN| E[Link to existing product]
    D -->|Yes, by Brand+SKU| E
    D -->|No match found| F{Has EAN or Brand+SKU?}
    F -->|Yes| G[Create new product]
    F -->|No| H[Ignore product - insufficient data]
    E --> I[Check for price changes]
    G --> I
    H --> J[End process]
    I -->|Price changed| K[Record in price_changes table]
    I -->|No price change| J
    K --> J
```

## Data Storage Strategy

```mermaid
flowchart LR
    subgraph "Temporary Storage"
        A[scraped_products]
    end
    
    subgraph "Permanent Storage"
        B[products]
        C[price_changes]
    end
    
    A -->|Match & Link| B
    A -->|Record Price Changes| C
    
    subgraph "Our Prices"
        D[products.our_price]
        E[products.cost_price]
    end
    
    subgraph "Competitor Prices"
        F[price_changes table]
    end
```

## Database Relationships

```mermaid
erDiagram
    USERS ||--o{ COMPETITORS : owns
    USERS ||--o{ PRODUCTS : owns
    COMPETITORS ||--o{ SCRAPERS : has
    COMPETITORS ||--o{ SCRAPED_PRODUCTS : provides
    SCRAPERS ||--o{ SCRAPED_PRODUCTS : generates
    PRODUCTS ||--o{ PRICE_CHANGES : tracks
    COMPETITORS ||--o{ PRICE_CHANGES : provides
    SCRAPED_PRODUCTS }|--o| PRODUCTS : matches
```

## Product Matching Logic

```mermaid
flowchart TD
    A[New scraped product] --> B{Has EAN?}
    B -->|Yes| C[Search for product with matching EAN]
    B -->|No| F{Has Brand and SKU?}
    
    C --> D{Match found?}
    D -->|Yes| E[Link to existing product]
    D -->|No| F
    
    F -->|Yes| G[Search for product with matching Brand+SKU]
    F -->|No| N[Ignore product - insufficient data]
    
    G --> H{Match found?}
    H -->|Yes| I[Link to existing product]
    H -->|No| J[Create new product]
    
    E --> K[Check for price changes]
    I --> K
    J --> K
    N --> M[End process]
    
    K -->|Price changed| L[Record in price_changes table]
    K -->|No change| M
    L --> M