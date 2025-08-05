import fs from 'fs';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Configurações
const SHOPEE_BASE_URL = 'https://shopee.com.br';
const MAX_PAGES = 3;
const PRODUCTS_LIMIT = 20;

// Diferentes URLs para testar
const SEARCH_URLS = [
    'https://shopee.com.br/search?keyword=smartphone',
    'https://shopee.com.br/search?keyword=fone',
    'https://shopee.com.br/search?keyword=cabo',
    'https://shopee.com.br/Celulares-e-Smartphones-cat.11036030',
    'https://shopee.com.br/Eletr%C3%B4nicos-cat.11036031'
];

// Headers mais completos para simular um navegador real
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

// Função para analisar a estrutura HTML
function analyzeHTML(html, url) {
    const $ = cheerio.load(html);
    
    console.log(`\n🔍 ANÁLISE DA PÁGINA: ${url}`);
    console.log(`📏 Tamanho do HTML: ${html.length} caracteres`);
    
    // Verificar se a página carregou corretamente
    const title = $('title').text();
    console.log(`📄 Título da página: "${title}"`);
    
    // Procurar por indicadores de que é uma página de busca/produtos
    const indicators = [
        'search-result', 'product', 'item', 'card', 'listing',
        'shopee-search', 'grid', 'catalog', 'merchandise'
    ];
    
    let foundIndicators = [];
    indicators.forEach(indicator => {
        const elements = $(`[class*="${indicator}"], [id*="${indicator}"]`);
        if (elements.length > 0) {
            foundIndicators.push(`${indicator}: ${elements.length}`);
        }
    });
    
    console.log(`🎯 Indicadores encontrados: ${foundIndicators.join(', ') || 'Nenhum'}`);
    
    // Verificar diferentes estruturas de dados
    const scripts = $('script').toArray();
    let hasJsonData = false;
    
    scripts.forEach((script, index) => {
        const content = $(script).html() || '';
        if (content.includes('window.__INITIAL_STATE__') || 
            content.includes('window.__APOLLO_STATE__') ||
            content.includes('"products"') ||
            content.includes('"items"')) {
            hasJsonData = true;
            console.log(`📊 Script ${index} contém dados estruturados`);
            
            // Tentar extrair dados JSON
            try {
                if (content.includes('window.__INITIAL_STATE__')) {
                    const match = content.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
                    if (match) {
                        const data = JSON.parse(match[1]);
                        console.log(`🗃️ Dados encontrados em __INITIAL_STATE__:`, Object.keys(data));
                    }
                }
            } catch (e) {
                console.log(`⚠️ Erro ao parsear JSON do script ${index}`);
            }
        }
    });
    
    if (!hasJsonData) {
        console.log(`⚠️ Nenhum script com dados estruturados encontrado`);
    }
    
    // Listar as 20 classes mais comuns
    const allElements = $('*').toArray();
    const classCount = {};
    
    allElements.forEach(el => {
        const className = $(el).attr('class');
        if (className) {
            className.split(' ').forEach(cls => {
                if (cls.trim()) {
                    classCount[cls] = (classCount[cls] || 0) + 1;
                }
            });
        }
    });
    
    const topClasses = Object.entries(classCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([cls, count]) => `${cls}(${count})`)
        .join(', ');
    
    console.log(`📋 Top 20 classes: ${topClasses}`);
    
    return { title, foundIndicators, hasJsonData, classCount };
}

// Função melhorada para extrair produtos
function extractProducts($, url) {
    let products = [];
    
    console.log(`\n🎯 TENTANDO EXTRAIR PRODUTOS DE: ${url}`);
    
    // Lista expandida de seletores possíveis
    const possibleSelectors = [
        // Seletores específicos da Shopee
        '.shopee-search-item-result__item',
        '.col-xs-2-4.shopee-search-item-result__item',
        '[data-sqe="item"]',
        '.shopee-item-card',
        '.item-card-special',
        '.search-item-card',
        'div[data-testid="item-card"]',
        
        // Seletores genéricos de e-commerce
        '.product-item',
        '.product-card',
        '.item-card',
        '.product',
        '.item',
        '[class*="product"]',
        '[class*="item"]',
        '[class*="card"]',
        
        // Seletores baseados em grid/layout
        '.col-2-4',
        '.col-xs-2-4',
        '[class*="col-"]',
        '.grid-item',
        
        // Seletores baseados em links/anchors
        'a[href*="/product/"]',
        'a[href*="/item/"]',
        'a[href*="-i."]'
    ];
    
    for (const selector of possibleSelectors) {
        const items = $(selector);
        console.log(`🔍 Seletor "${selector}": ${items.length} elementos`);
        
        if (items.length > 0) {
            console.log(`✅ Processando com seletor: ${selector}`);
            
            items.each((i, el) => {
                if (products.length >= PRODUCTS_LIMIT) return;
                
                const $el = $(el);
                
                // Extrair informações com múltiplas estratégias
                let title = extractTitle($el);
                let price = extractPrice($el);
                let image = extractImage($el);
                let productUrl = extractUrl($el);
                let discount = extractDiscount($el);
                
                // Log detalhado dos primeiros 3 produtos
                if (i < 3) {
                    console.log(`\n📦 PRODUTO ${i + 1}:`);
                    console.log(`  Título: ${title ? '✅' : '❌'} "${title}"`);
                    console.log(`  Preço: ${price ? '✅' : '❌'} "${price}"`);
                    console.log(`  Imagem: ${image ? '✅' : '❌'} "${image?.substring(0, 60)}..."`);
                    console.log(`  URL: ${productUrl ? '✅' : '❌'} "${productUrl?.substring(0, 60)}..."`);
                    console.log(`  Desconto: ${discount ? '✅' : '❌'} "${discount}"`);
                }
                
                // Critério mínimo: ter título OU imagem E ter URL
                if ((title || image) && productUrl) {
                    products.push({
                        title: title || 'Produto sem título',
                        price: price || 'Consulte o preço',
                        image: image || 'https://via.placeholder.com/200x200?text=Sem+Imagem',
                        url: productUrl,
                        discount: discount || ''
                    });
                }
            });
            
            if (products.length > 0) {
                console.log(`🎉 Encontrados ${products.length} produtos válidos!`);
                break; // Se encontrou produtos, não precisa testar outros seletores
            }
        }
    }
    
    return products;
}

// Funções auxiliares para extração
function extractTitle($el) {
    const titleSelectors = [
        'img[alt]', // Alt da imagem é frequentemente o título
        '[data-sqe="name"]',
        '.shopee-item-result__name',
        '.product-title',
        '.item-title',
        '.title',
        '[class*="title"]',
        '[class*="name"]',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ];
    
    for (const sel of titleSelectors) {
        if (sel === 'img[alt]') {
            const alt = $el.find('img').attr('alt');
            if (alt && alt.trim() && alt.length > 5) return alt.trim();
        } else {
            const text = $el.find(sel).first().text().trim();
            if (text && text.length > 5) return text;
        }
    }
    
    return '';
}

function extractPrice($el) {
    const priceSelectors = [
        '[data-sqe="price"]',
        '.shopee-item-result__price',
        '.price',
        '.product-price',
        '.item-price',
        '[class*="price"]',
        '[class*="cost"]',
        '[class*="value"]'
    ];
    
    for (const sel of priceSelectors) {
        const text = $el.find(sel).first().text().trim();
        if (text && (text.includes('R$') || text.includes('$') || /\d+[,.]?\d*/.test(text))) {
            return text;
        }
    }
    
    return '';
}

function extractImage($el) {
    const img = $el.find('img').first();
    let src = img.attr('src') || img.attr('data-src') || img.attr('data-original') || '';
    
    if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = SHOPEE_BASE_URL + src;
        else if (!src.startsWith('http')) src = SHOPEE_BASE_URL + '/' + src;
    }
    
    return src;
}

function extractUrl($el) {
    let href = $el.find('a').first().attr('href') || $el.attr('href') || '';
    
    if (href) {
        if (href.startsWith('/')) href = SHOPEE_BASE_URL + href;
        else if (!href.startsWith('http')) href = SHOPEE_BASE_URL + '/' + href;
    }
    
    return href;
}

function extractDiscount($el) {
    const discountSelectors = [
        '.discount',
        '.sale',
        '.off',
        '[class*="discount"]',
        '[class*="sale"]',
        '[class*="off"]'
    ];
    
    for (const sel of discountSelectors) {
        const text = $el.find(sel).first().text().trim();
        if (text && (text.includes('%') || text.includes('OFF'))) {
            return text;
        }
    }
    
    return '';
}

async function scrapeShopee() {
    let allProducts = [];
    console.log('🚀 INICIANDO SCRAPING AVANÇADO DA SHOPEE\n');

    for (let i = 0; i < SEARCH_URLS.length && allProducts.length < PRODUCTS_LIMIT; i++) {
        const baseUrl = SEARCH_URLS[i];
        
        try {
            console.log(`\n🔄 TESTANDO URL ${i + 1}/${SEARCH_URLS.length}: ${baseUrl}`);
            
            const response = await fetch(baseUrl, { 
                headers: HEADERS,
                timeout: 15000
            });
            
            console.log(`📡 Status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                console.log(`❌ Resposta não OK, pulando...`);
                continue;
            }
            
            const html = await response.text();
            
            // Salvar HTML para debug
            const filename = `debug_${i}_${Date.now()}.html`;
            fs.writeFileSync(filename, html);
            console.log(`💾 HTML salvo em: ${filename}`);
            
            // Analisar estrutura
            const analysis = analyzeHTML(html, baseUrl);
            
            // Tentar extrair produtos
            const $ = cheerio.load(html);
            const products = extractProducts($, baseUrl);
            
            if (products.length > 0) {
                allProducts.push(...products);
                console.log(`✅ Coletados ${products.length} produtos desta URL`);
                console.log(`📊 Total acumulado: ${allProducts.length} produtos`);
            } else {
                console.log(`❌ Nenhum produto encontrado nesta URL`);
            }
            
            // Aguardar entre requisições
            await sleep(5000 + Math.random() * 3000);
            
        } catch (error) {
            console.error(`❌ Erro na URL ${baseUrl}:`, error.message);
        }
    }

    console.log(`\n🎯 RESULTADO FINAL: ${allProducts.length} produtos coletados`);
    return allProducts.slice(0, PRODUCTS_LIMIT);
}

// Função de fallback melhorada
function getFallbackProducts() {
    console.log('📦 Usando produtos de fallback...');
    return [
        {
            title: "Smartphone Samsung Galaxy A54 128GB 5G",
            price: "R$ 1.299,90",
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=📱+Galaxy+A54",
            url: "https://shopee.com.br/smartphone-samsung",
            discount: "23% OFF"
        },
        {
            title: "Fone de Ouvido JBL Tune 510BT Bluetooth",
            price: "R$ 149,90",
            image: "https://via.placeholder.com/300x300/4ECDC4/FFFFFF?text=🎧+JBL+510BT",
            url: "https://shopee.com.br/fone-jbl",
            discount: "40% OFF"
        },
        {
            title: "Power Bank Xiaomi 10000mAh Carregamento Rápido",
            price: "R$ 89,90",
            image: "https://via.placeholder.com/300x300/45B7D1/FFFFFF?text=🔋+Xiaomi+10k",
            url: "https://shopee.com.br/power-bank-xiaomi",
            discount: "35% OFF"
        },
        {
            title: "Cabo USB-C para Lightning Apple Original 1m",
            price: "R$ 159,90",
            image: "https://via.placeholder.com/300x300/96CEB4/FFFFFF?text=🔌+Apple+Cable",
            url: "https://shopee.com.br/cabo-apple",
            discount: "15% OFF"
        },
        {
            title: "Película de Vidro 3D iPhone 14 Pro Max",
            price: "R$ 29,90",
            image: "https://via.placeholder.com/300x300/FFEAA7/FFFFFF?text=📱+Película+3D",
            url: "https://shopee.com.br/pelicula-iphone",
            discount: "50% OFF"
        },
        {
            title: "Carregador Turbo 33W USB-C Xiaomi Original",
            price: "R$ 79,90",
            image: "https://via.placeholder.com/300x300/DDA0DD/FFFFFF?text=⚡+Carregador+33W",
            url: "https://shopee.com.br/carregador-xiaomi",
            discount: "25% OFF"
        }
    ];
}

async function main() {
    try {
        console.log('🚀 INICIANDO PROCESSO DE SCRAPING AVANÇADO...\n');
        
        let products = await scrapeShopee();
        
        // Se não conseguiu produtos, usar fallback
        if (products.length === 0) {
            console.log('\n⚠️ NENHUM PRODUTO ENCONTRADO NO SCRAPING');
            console.log('📦 Usando produtos de exemplo (fallback)');
            products = getFallbackProducts();
        }

        const now = new Date();
        const lastUpdate = now.toLocaleString('pt-BR', {
            dateStyle: 'full',
            timeStyle: 'medium',
            timeZone: 'America/Sao_Paulo'
        });

        const data = {
            lastUpdate,
            products,
            totalProducts: products.length,
            scrapedAt: now.toISOString(),
            source: products.length > 0 && products[0].url.includes('placeholder') ? 'fallback' : 'scraping',
            debug: {
                searchUrls: SEARCH_URLS,
                userAgent: HEADERS['User-Agent'],
                timestamp: now.toISOString()
            }
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        console.log(`\n✅ ARQUIVO products.json SALVO!`);
        console.log(`📊 ${products.length} produtos salvos`);
        console.log(`📅 Última atualização: ${lastUpdate}`);
        console.log(`🔧 Fonte: ${data.source}`);

        // Log do arquivo criado
        const fileSize = fs.statSync('products.json').size;
        console.log(`📁 Tamanho do arquivo: ${(fileSize / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO NO SCRAPING:', error);
        
        // Em caso de erro, criar arquivo com produtos de exemplo
        const fallbackData = {
            lastUpdate: new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            products: getFallbackProducts(),
            totalProducts: 6,
            scrapedAt: new Date().toISOString(),
            source: 'fallback-error',
            error: error.message
        };
        
        fs.writeFileSync('products.json', JSON.stringify(fallbackData, null, 2));
        console.log('📁 Arquivo de fallback criado devido ao erro');
        
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}