import fs from 'fs';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Configurações
const PRODUCTS_LIMIT = 50; // Aumentando para ter mais variedade
const AFFILIATE_ID = '18369330491'; // Só para Shopee

// Headers mais completos para simular um navegador real
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Connection': 'keep-alive'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// URLs de busca por plataforma
const PLATFORM_URLS = {
    shopee: [
        'https://shopee.com.br/search?keyword=smartphone',
        'https://shopee.com.br/search?keyword=fone+bluetooth',
        'https://shopee.com.br/search?keyword=power+bank',
        'https://shopee.com.br/Celulares-e-Smartphones-cat.11036030'
    ],
    mercadolivre: [
        'https://lista.mercadolivre.com.br/smartphone',
        'https://lista.mercadolivre.com.br/fone-bluetooth',
        'https://lista.mercadolivre.com.br/carregador-celular',
        'https://lista.mercadolivre.com.br/cabo-usb-c'
    ],
    amazon: [
        'https://www.amazon.com.br/s?k=smartphone',
        'https://www.amazon.com.br/s?k=fone+de+ouvido+bluetooth',
        'https://www.amazon.com.br/s?k=carregador+portatil',
        'https://www.amazon.com.br/s?k=cabo+usb'
    ],
    aliexpress: [
        'https://pt.aliexpress.com/wholesale?SearchText=smartphone',
        'https://pt.aliexpress.com/wholesale?SearchText=wireless+earphones',
        'https://pt.aliexpress.com/wholesale?SearchText=power+bank',
        'https://pt.aliexpress.com/wholesale?SearchText=phone+case'
    ]
};

// Seletores específicos por plataforma
const SELECTORS = {
    shopee: {
        container: ['.shopee-search-item-result__item', '[data-sqe="item"]', '.item-card-special'],
        title: ['img[alt]', '[data-sqe="name"]', '.shopee-item-result__name'],
        price: ['[data-sqe="price"]', '.shopee-item-result__price', '[class*="price"]'],
        image: ['img'],
        url: ['a'],
        discount: ['.discount', '[class*="discount"]', '[class*="off"]']
    },
    mercadolivre: {
        container: ['.ui-search-result', '.ui-search-result__wrapper', '.ui-search-result__content'],
        title: ['.ui-search-item__title', 'h2 a', '.ui-search-item__brand-discoverability'],
        price: ['.ui-search-price__part', '.price-tag-amount', '[class*="price"]'],
        image: ['.ui-search-result-image__element', 'img'],
        url: ['.ui-search-result__content a', '.ui-search-link'],
        discount: ['.ui-search-price__discount', '[class*="discount"]']
    },
    amazon: {
        container: ['[data-component-type="s-search-result"]', '.s-result-item', '.sg-col-inner'],
        title: ['h2 a span', '.s-title-instructions-style', 'h2 span'],
        price: ['.a-price-whole', '.a-price .a-offscreen', '[class*="price"]'],
        image: ['.s-image', 'img'],
        url: ['h2 a', '.s-link-style'],
        discount: ['.a-badge-text', '[class*="discount"]', '[class*="save"]']
    },
    aliexpress: {
        container: ['.list--gallery--C2f2tvm', '.product-snippet', '[class*="item"]'],
        title: ['.titles--wrap--UhxZQDr', '.product-title', 'h1', 'h2', 'h3'],
        price: ['.price-current', '.notranslate', '[class*="price"]'],
        image: ['.images--item--3XZa6xj img', 'img'],
        url: ['a'],
        discount: ['.price-discount', '[class*="discount"]', '[class*="off"]']
    }
};

// Função para tentar extrair dados com múltiplos seletores
function tryExtractData($element, selectors, attribute = null) {
    for (const selector of selectors) {
        const element = $element.find(selector).first();
        if (element.length > 0) {
            if (attribute) {
                const value = element.attr(attribute);
                if (value && value.trim()) return value.trim();
            } else {
                const text = element.text().trim();
                if (text && text.length > 0) return text;
            }
        }
    }
    return '';
}

// Função para extrair produtos de uma plataforma específica
async function extractFromPlatform(platform, urls) {
    let products = [];
    console.log(`\n🔍 EXTRAINDO DE ${platform.toUpperCase()}`);
    
    for (const url of urls) {
        if (products.length >= 15) break; // Limite por plataforma
        
        try {
            console.log(`📡 Acessando: ${url}`);
            
            const response = await fetch(url, { 
                headers: HEADERS,
                timeout: 15000
            });
            
            if (!response.ok) {
                console.log(`❌ Erro ${response.status} para ${url}`);
                continue;
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Usar seletores específicos da plataforma
            const selectors = SELECTORS[platform];
            
            for (const containerSelector of selectors.container) {
                const items = $(containerSelector);
                console.log(`🔍 Seletor "${containerSelector}": ${items.length} itens`);
                
                if (items.length > 0) {
                    items.each((i, el) => {
                        if (products.length >= 15) return;
                        
                        const $el = $(el);
                        
                        let title = tryExtractData($el, selectors.title);
                        let price = tryExtractData($el, selectors.price);
                        let image = tryExtractData($el, selectors.image, 'src') || 
                                   tryExtractData($el, selectors.image, 'data-src') ||
                                   tryExtractData($el, selectors.image, 'data-original');
                        let productUrl = tryExtractData($el, selectors.url, 'href');
                        let discount = tryExtractData($el, selectors.discount);
                        
                        // Limpar e processar dados
                        title = cleanTitle(title);
                        price = cleanPrice(price, platform);
                        image = processImageUrl(image, platform);
                        productUrl = processProductUrl(productUrl, platform, url);
                        discount = cleanDiscount(discount);
                        
                        // Critério mínimo para aceitar o produto
                        if (title && title.length > 10 && productUrl) {
                            products.push({
                                title,
                                price: price || 'Consulte o preço',
                                image: image || getPlaceholderImage(platform),
                                url: productUrl,
                                discount: discount || '',
                                platform: platform,
                                scraped_at: new Date().toISOString()
                            });
                        }
                    });
                    
                    if (products.length > 0) break;
                }
            }
            
            console.log(`✅ ${products.length} produtos coletados de ${platform}`);
            await sleep(3000 + Math.random() * 2000);
            
        } catch (error) {
            console.error(`❌ Erro em ${url}:`, error.message);
        }
    }
    
    return products;
}

// Funções auxiliares para limpeza de dados
function cleanTitle(title) {
    if (!title) return '';
    
    // Remover caracteres estranhos e limitar tamanho
    return title
        .replace(/[^\w\s\-\(\)\[\]\/\+\&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
}

function cleanPrice(price, platform) {
    if (!price) return '';
    
    // Extrair apenas números e símbolos monetários
    let cleaned = price.replace(/[^\d,.\$R\s]/g, '').trim();
    
    // Se não tem R$, adicionar baseado na plataforma
    if (cleaned && !cleaned.includes('R$') && !cleaned.includes('$')) {
        if (platform === 'aliexpress') {
            cleaned = 'US$ ' + cleaned;
        } else {
            cleaned = 'R$ ' + cleaned;
        }
    }
    
    return cleaned;
}

function processImageUrl(image, platform) {
    if (!image) return '';
    
    const baseUrls = {
        shopee: 'https://shopee.com.br',
        mercadolivre: 'https://mercadolivre.com.br',
        amazon: 'https://amazon.com.br',
        aliexpress: 'https://pt.aliexpress.com'
    };
    
    if (image.startsWith('//')) return 'https:' + image;
    if (image.startsWith('/')) return baseUrls[platform] + image;
    if (!image.startsWith('http')) return baseUrls[platform] + '/' + image;
    
    return image;
}

function processProductUrl(url, platform, baseUrl) {
    if (!url) return '';
    
    const baseUrls = {
        shopee: 'https://shopee.com.br',
        mercadolivre: 'https://mercadolivre.com.br',
        amazon: 'https://amazon.com.br',
        aliexpress: 'https://pt.aliexpress.com'
    };
    
    if (url.startsWith('/')) url = baseUrls[platform] + url;
    if (!url.startsWith('http')) url = baseUrls[platform] + '/' + url;
    
    // Adicionar affiliate ID apenas para Shopee
    if (platform === 'shopee') {
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

function cleanDiscount(discount) {
    if (!discount) return '';
    return discount.replace(/[^\d%OFF\-]/g, '').trim();
}

function getPlaceholderImage(platform) {
    const colors = {
        shopee: 'FF6B35',
        mercadolivre: 'FFE500',
        amazon: 'FF9900',
        aliexpress: 'FF4747'
    };
    
    return `https://via.placeholder.com/300x300/${colors[platform]}/FFFFFF?text=${platform.toUpperCase()}`;
}

// Função para obter produtos de fallback de todas as plataformas
function getFallbackProducts() {
    console.log('📦 Usando produtos de fallback de múltiplas plataformas...');
    
    return [
        // Shopee
        {
            title: "Smartphone Samsung Galaxy A54 5G 128GB",
            price: "R$ 1.299,90",
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=📱+Galaxy+A54",
            url: `https://shopee.com.br/smartphone-samsung?affiliate_id=${AFFILIATE_ID}`,
            discount: "23% OFF",
            platform: "shopee"
        },
        {
            title: "Fone JBL Tune 510BT Bluetooth Sem Fio",
            price: "R$ 149,90",
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=🎧+JBL+510BT",
            url: `https://shopee.com.br/fone-jbl?affiliate_id=${AFFILIATE_ID}`,
            discount: "40% OFF",
            platform: "shopee"
        },
        
        // Mercado Livre
        {
            title: "iPhone 14 128GB Azul Tela 6.1 iOS 5G",
            price: "R$ 3.599,00",
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=📱+iPhone+14",
            url: "https://mercadolivre.com.br/iphone-14",
            discount: "15% OFF",
            platform: "mercadolivre"
        },
        {
            title: "Echo Dot 5ª Geração Alexa Smart Speaker",
            price: "R$ 249,90",
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=🔊+Echo+Dot",
            url: "https://mercadolivre.com.br/echo-dot",
            discount: "30% OFF",
            platform: "mercadolivre"
        },
        
        // Amazon
        {
            title: "Kindle 11ª Geração Luz Embutida 16GB",
            price: "R$ 399,00",
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=📚+Kindle+11",
            url: "https://amazon.com.br/kindle-11-geracao",
            discount: "25% OFF",
            platform: "amazon"
        },
        {
            title: "Fire TV Stick 4K Max Streaming Player",
            price: "R$ 379,00",
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=📺+Fire+TV+4K",
            url: "https://amazon.com.br/fire-tv-stick-4k",
            discount: "20% OFF",
            platform: "amazon"
        },
        
        // AliExpress
        {
            title: "Xiaomi Redmi Note 12 Pro 5G Global 256GB",
            price: "US$ 189.99",
            image: "https://via.placeholder.com/300x300/FF4747/FFFFFF?text=📱+Redmi+Note+12",
            url: "https://pt.aliexpress.com/xiaomi-redmi-note-12",
            discount: "45% OFF",
            platform: "aliexpress"
        },
        {
            title: "Earbuds Pro 3 TWS Bluetooth 5.3 Wireless",
            price: "US$ 12.99",
            image: "https://via.placeholder.com/300x300/FF4747/FFFFFF?text=🎧+Earbuds+Pro",
            url: "https://pt.aliexpress.com/earbuds-pro-3",
            discount: "70% OFF",
            platform: "aliexpress"
        },
        
        // Mais produtos variados
        {
            title: "Power Bank 20000mAh Carregamento Rápido PD",
            price: "R$ 89,90",
            image: "https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=🔋+Power+Bank",
            url: `https://shopee.com.br/power-bank-20000?affiliate_id=${AFFILIATE_ID}`,
            discount: "35% OFF",
            platform: "shopee"
        },
        {
            title: "Suporte Veicular Magnético Para Celular",
            price: "R$ 39,90",
            image: "https://via.placeholder.com/300x300/96CEB4/FFFFFF?text=🚗+Suporte+Car",
            url: "https://mercadolivre.com.br/suporte-veicular",
            discount: "50% OFF",
            platform: "mercadolivre"
        },
        {
            title: "Cabo USB-C 3.1 Carregamento Rápido 1.2m",
            price: "R$ 24,90",
            image: "https://via.placeholder.com/300x300/DDA0DD/FFFFFF?text=🔌+Cabo+USB-C",
            url: "https://amazon.com.br/cabo-usb-c",
            discount: "60% OFF",
            platform: "amazon"
        },
        {
            title: "Smartwatch T500 Plus Tela Infinita Bluetooth",
            price: "US$ 15.99",
            image: "https://via.placeholder.com/300x300/87CEEB/FFFFFF?text=⌚+Smartwatch",
            url: "https://pt.aliexpress.com/smartwatch-t500",
            discount: "80% OFF",
            platform: "aliexpress"
        }
    ];
}

// Função principal de scraping
async function scrapeAllPlatforms() {
    let allProducts = [];
    console.log('🚀 INICIANDO SCRAPING DE MÚLTIPLAS PLATAFORMAS\n');

    // Tentar extrair de cada plataforma
    for (const [platform, urls] of Object.entries(PLATFORM_URLS)) {
        console.log(`\n🔄 PROCESSANDO ${platform.toUpperCase()}`);
        
        try {
            const products = await extractFromPlatform(platform, urls);
            if (products.length > 0) {
                allProducts.push(...products);
                console.log(`✅ ${products.length} produtos coletados de ${platform}`);
            } else {
                console.log(`❌ Nenhum produto coletado de ${platform}`);
            }
        } catch (error) {
            console.error(`❌ Erro geral em ${platform}:`, error.message);
        }
        
        // Aguardar entre plataformas
        await sleep(5000);
    }

    console.log(`\n📊 TOTAL GERAL: ${allProducts.length} produtos de todas as plataformas`);
    return allProducts.slice(0, PRODUCTS_LIMIT);
}

async function main() {
    try {
        console.log('🚀 INICIANDO SCRAPING MULTI-PLATAFORMA...\n');
        
        let products = await scrapeAllPlatforms();
        
        // Se não conseguiu produtos suficientes, usar fallback
        if (products.length < 10) {
            console.log('\n⚠️ POUCOS PRODUTOS ENCONTRADOS NO SCRAPING');
            console.log('📦 Complementando com produtos de exemplo');
            const fallbackProducts = getFallbackProducts();
            products = [...products, ...fallbackProducts].slice(0, PRODUCTS_LIMIT);
        }

        // Embaralhar produtos para variedade
        products = products.sort(() => Math.random() - 0.5);

        const now = new Date();
        const lastUpdate = now.toLocaleString('pt-BR', {
            dateStyle: 'full',
            timeStyle: 'medium',
            timeZone: 'America/Sao_Paulo'
        });

        // Contar produtos por plataforma
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
            hasAffiliateShopee: true,
            debug: {
                platformUrls: PLATFORM_URLS,
                userAgent: HEADERS['User-Agent'],
                timestamp: now.toISOString(),
                productsPerPlatform: platformCount
            }
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        console.log(`\n✅ ARQUIVO products.json SALVO!`);
        console.log(`📊 ${products.length} produtos salvos`);
        console.log(`📅 Última atualização: ${lastUpdate}`);
        console.log(`🏪 Plataformas: ${Object.keys(platformCount).join(', ')}`);
        console.log(`📈 Distribuição:`, platformCount);

        const fileSize = fs.statSync('products.json').size;
        console.log(`📁 Tamanho do arquivo: ${(fileSize / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NO SCRAPING:', error);
        
        // Em caso de erro, criar arquivo apenas com produtos de exemplo
        const fallbackData = {
            lastUpdate: new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            products: getFallbackProducts(),
            totalProducts: getFallbackProducts().length,
            scrapedAt: new Date().toISOString(),
            platforms: {
                shopee: 3,
                mercadolivre: 3,
                amazon: 3,
                aliexpress: 3
            },
            hasAffiliateShopee: true,
            source: 'fallback-error',
            error: error.message
        };
        
        fs.writeFileSync('products.json', JSON.stringify(fallbackData, null, 2));
        console.log('📁 Arquivo de fallback multi-plataforma criado devido ao erro');
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}