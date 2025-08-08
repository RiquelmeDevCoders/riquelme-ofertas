import fs from 'fs';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const PRODUCTS_LIMIT = 50;
const AFFILIATE_ID = '18369330491';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// URLs que realmente funcionam para scraping
const PLATFORM_URLS = {
    mercadolivre: [
        'https://lista.mercadolivre.com.br/smartphone#D[A:smartphone]',
        'https://lista.mercadolivre.com.br/fone-ouvido-bluetooth#D[A:fone%20ouvido%20bluetooth]',
        'https://lista.mercadolivre.com.br/smartwatch#D[A:smartwatch]'
    ],
    shopee: [
        'https://shopee.com.br/Celulares-e-Smartphones-cat.11036030',
        'https://shopee.com.br/Fones-de-Ouvido-cat.11013247'
    ],
    amazon: [
        'https://www.amazon.com.br/s?k=smartphone&ref=sr_pg_1',
        'https://www.amazon.com.br/s?k=fone+bluetooth&ref=sr_pg_1'
    ]
};

// Seletores mais precisos e testados
const SELECTORS = {
    mercadolivre: {
        container: '.ui-search-result',
        title: '.ui-search-item__title',
        price: '.andes-money-amount__fraction',
        image: '.ui-search-result-image__element',
        url: '.ui-search-result__content a',
        discount: '.ui-search-price__discount'
    },
    shopee: {
        container: '[data-sqe="item"]',
        title: '[data-sqe="name"]',
        price: '[data-sqe="price"]',
        image: 'img[src*="shopee"]',
        url: 'a',
        discount: '.percent'
    },
    amazon: {
        container: '[data-component-type="s-search-result"]',
        title: 'h2 a span',
        price: '.a-price-whole',
        image: '.s-image',
        url: 'h2 a',
        discount: '.a-badge-text'
    }
};

function extractData($element, selector, attribute = null) {
    const element = $element.find(selector).first();
    if (element.length === 0) return '';
    
    if (attribute) {
        return element.attr(attribute)?.trim() || '';
    }
    return element.text()?.trim() || '';
}

function cleanTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^\w\s\-\(\)\[\]\/\+\&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

function cleanPrice(price, platform) {
    if (!price) return 'Consulte o preço';
    
    let cleaned = price.replace(/[^\d,.\$R\s]/g, '').trim();
    
    if (cleaned && !cleaned.includes('R$') && !cleaned.includes('$')) {
        cleaned = 'R$ ' + cleaned;
    }
    
    return cleaned || 'Consulte o preço';
}

function processImageUrl(image, platform) {
    if (!image) return `https://via.placeholder.com/300x300/cccccc/666666?text=${platform}`;
    
    if (image.startsWith('//')) return 'https:' + image;
    if (image.startsWith('/')) {
        const baseUrls = {
            shopee: 'https://shopee.com.br',
            mercadolivre: 'https://mercadolivre.com.br',
            amazon: 'https://amazon.com.br'
        };
        return baseUrls[platform] + image;
    }
    if (!image.startsWith('http')) return 'https://' + image;
    
    return image;
}

function processProductUrl(url, platform, baseUrl) {
    if (!url) return '';
    
    const baseUrls = {
        shopee: 'https://shopee.com.br',
        mercadolivre: 'https://mercadolivre.com.br',
        amazon: 'https://amazon.com.br'
    };
    
    if (url.startsWith('/')) url = baseUrls[platform] + url;
    if (!url.startsWith('http')) url = baseUrls[platform] + '/' + url;
    
    if (platform === 'shopee' && !url.includes('affiliate_id')) {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('affiliate_id', AFFILIATE_ID);
            return urlObj.toString();
        } catch (e) {
            return url;
        }
    }
    
    return url;
}

async function extractFromPlatform(platform, urls) {
    let products = [];
    console.log(`🔍 Extraindo de ${platform.toUpperCase()}`);
    
    for (const url of urls) {
        if (products.length >= 15) break;
        
        try {
            console.log(`📡 ${url}`);
            
            const response = await fetch(url, { 
                headers: HEADERS,
                timeout: 20000
            });
            
            if (!response.ok) {
                console.log(`❌ ${response.status} - ${url}`);
                continue;
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const selectors = SELECTORS[platform];
            const items = $(selectors.container);
            
            console.log(`📦 ${items.length} itens encontrados`);
            
            items.slice(0, 15).each((i, el) => {
                if (products.length >= 15) return;
                
                const $el = $(el);
                
                const title = extractData($el, selectors.title);
                const price = extractData($el, selectors.price);
                const image = extractData($el, selectors.image, 'src') || 
                            extractData($el, selectors.image, 'data-src');
                const productUrl = extractData($el, selectors.url, 'href');
                const discount = extractData($el, selectors.discount);
                
                const cleanedTitle = cleanTitle(title);
                const cleanedPrice = cleanPrice(price, platform);
                const processedImage = processImageUrl(image, platform);
                const processedUrl = processProductUrl(productUrl, platform, url);
                
                if (cleanedTitle && cleanedTitle.length > 10 && processedUrl) {
                    products.push({
                        title: cleanedTitle,
                        price: cleanedPrice,
                        image: processedImage,
                        url: processedUrl,
                        discount: discount || '',
                        platform: platform,
                        scraped_at: new Date().toISOString()
                    });
                }
            });
            
            console.log(`✅ ${products.length} produtos coletados`);
            await sleep(3000);
            
        } catch (error) {
            console.error(`❌ Erro em ${url}:`, error.message);
        }
    }
    
    return products;
}

function getFallbackProducts() {
    return [
        {
            title: "Samsung Galaxy A54 5G 128GB Violeta",
            price: "R$ 1.199,00",
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=Galaxy+A54",
            url: `https://shopee.com.br/produto-samsung-galaxy?affiliate_id=${AFFILIATE_ID}`,
            discount: "25% OFF",
            platform: "shopee"
        },
        {
            title: "JBL Tune 510BT Fone Bluetooth Sem Fio",
            price: "R$ 129,90",
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=JBL+510BT",
            url: `https://shopee.com.br/jbl-fone-bluetooth?affiliate_id=${AFFILIATE_ID}`,
            discount: "35% OFF",
            platform: "shopee"
        },
        {
            title: "iPhone 13 128GB Azul Sierra",
            price: "R$ 3.199,00",
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=iPhone+13",
            url: "https://mercadolivre.com.br/iphone-13-128gb",
            discount: "18% OFF",
            platform: "mercadolivre"
        },
        {
            title: "Xiaomi Redmi Note 12 Pro 256GB",
            price: "R$ 1.499,00",
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=Redmi+Note+12",
            url: "https://mercadolivre.com.br/redmi-note-12-pro",
            discount: "22% OFF",
            platform: "mercadolivre"
        },
        {
            title: "Echo Dot 5ª Geração com Alexa",
            price: "R$ 219,00",
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=Echo+Dot+5",
            url: "https://amazon.com.br/echo-dot-5-geracao",
            discount: "31% OFF",
            platform: "amazon"
        },
        {
            title: "Fire TV Stick 4K Max",
            price: "R$ 329,00",
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=Fire+TV+4K",
            url: "https://amazon.com.br/fire-tv-stick-4k-max",
            discount: "27% OFF",
            platform: "amazon"
        }
    ];
}

async function scrapeAllPlatforms() {
    let allProducts = [];
    console.log('🚀 INICIANDO SCRAPING MULTI-PLATAFORMA');

    for (const [platform, urls] of Object.entries(PLATFORM_URLS)) {
        console.log(`\n🔄 ${platform.toUpperCase()}`);
        
        try {
            const products = await extractFromPlatform(platform, urls);
            if (products.length > 0) {
                allProducts.push(...products);
                console.log(`✅ ${products.length} produtos de ${platform}`);
            }
        } catch (error) {
            console.error(`❌ Erro em ${platform}:`, error.message);
        }
        
        await sleep(5000);
    }

    console.log(`\n📊 TOTAL: ${allProducts.length} produtos`);
    return allProducts.slice(0, PRODUCTS_LIMIT);
}

async function main() {
    try {
        console.log('🚀 INICIANDO SCRAPING...');
        
        let products = await scrapeAllPlatforms();
        
        if (products.length < 6) {
            console.log('\n⚠️ POUCOS PRODUTOS - USANDO FALLBACK');
            const fallbackProducts = getFallbackProducts();
            products = [...products, ...fallbackProducts].slice(0, PRODUCTS_LIMIT);
        }

        products = products.sort(() => Math.random() - 0.5);

        const now = new Date();
        const lastUpdate = now.toLocaleString('pt-BR', {
            dateStyle: 'full',
            timeStyle: 'medium',
            timeZone: 'America/Sao_Paulo'
        });

        const platformCount = products.reduce((acc, product) => {
            acc[product.platform] = (acc[product.platform] || 0) + 1;
            return acc;
        }, {});

        const data = {
            lastUpdate,
            products,
            totalProducts: products.length,
            scrapedAt: now.toISOString(),
            platforms: platformCount,
            hasAffiliateShopee: true
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        
        console.log(`\n✅ PRODUTOS SALVOS: ${products.length}`);
        console.log(`📅 ${lastUpdate}`);
        console.log(`🏪 Plataformas:`, platformCount);
        
        const fileSize = fs.statSync('products.json').size;
        console.log(`📁 ${(fileSize / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error.message);
        
        const fallbackData = {
            lastUpdate: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            products: getFallbackProducts(),
            totalProducts: getFallbackProducts().length,
            scrapedAt: new Date().toISOString(),
            platforms: { shopee: 2, mercadolivre: 2, amazon: 2 },
            hasAffiliateShopee: true,
            source: 'fallback-error',
            error: error.message
        };
        
        fs.writeFileSync('products.json', JSON.stringify(fallbackData, null, 2));
        console.log('📁 Fallback salvo devido ao erro');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}