import fs from 'fs';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Configurações
const SHOPEE_BASE_URL = 'https://shopee.com.br';
const SEARCH_URL = 'https://shopee.com.br/search?keyword=oferta&page=';
const MAX_PAGES = 2;
const PRODUCTS_LIMIT = 20;

// Headers para simular um navegador real
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
};

// Função para aguardar um tempo (evitar ser bloqueado)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeShopee() {
    let allProducts = [];
    console.log('🔍 Iniciando scraping da Shopee...');

    for (let page = 0; page < MAX_PAGES; page++) {
        try {
            console.log(`📄 Processando página ${page + 1}...`);
            
            const url = `${SEARCH_URL}${page}`;
            console.log(`🌐 URL: ${url}`);
            
            const response = await fetch(url, { 
                headers: HEADERS,
                timeout: 10000
            });
            
            if (!response.ok) {
                console.log(`❌ Erro HTTP ${response.status} na página ${page}`);
                continue;
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);

            // Log do HTML para debug (primeiros 500 caracteres)
            console.log('📄 HTML recebido (amostra):', html.substring(0, 500) + '...');

            // Diferentes seletores que a Shopee pode usar
            const possibleSelectors = [
                '.shopee-search-item-result__item',
                '.col-xs-2-4',
                '[data-sqe="item"]',
                '.item-card-special',
                '.shopee-item-card',
                'div[data-testid="item-card"]',
                '.search-item-card'
            ];

            let foundProducts = false;

            for (const selector of possibleSelectors) {
                const items = $(selector);
                console.log(`🔍 Testando seletor "${selector}": ${items.length} elementos encontrados`);
                
                if (items.length > 0) {
                    console.log(`✅ Encontrados ${items.length} itens com seletor: ${selector}`);
                    
                    items.each((i, el) => {
                        if (allProducts.length >= PRODUCTS_LIMIT) return;

                        const $el = $(el);
                        
                        // Tentar diferentes seletores para cada campo
                        const titleSelectors = [
                            '.ie3A+- div', '._10Wbs- div', '[data-sqe="name"]',
                            '.product-title', '.item-title', 'img'
                        ];
                        
                        const priceSelectors = [
                            '.ZEgARZ', '._3c5u7X', '[data-sqe="price"]',
                            '.price', '.item-price', '.product-price'
                        ];

                        let title = '';
                        for (const sel of titleSelectors) {
                            const text = $el.find(sel).first().text().trim();
                            if (text) {
                                title = text;
                                break;
                            }
                        }
                        
                        // Se não encontrou título no texto, tenta no alt da imagem
                        if (!title) {
                            title = $el.find('img').attr('alt') || '';
                        }
                        
                        let price = '';
                        for (const sel of priceSelectors) {
                            const text = $el.find(sel).first().text().trim();
                            if (text && (text.includes('R$') || text.includes('$') || /\d/.test(text))) {
                                price = text;
                                break;
                            }
                        }
                        
                        let image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
                        if (image && !image.startsWith('http')) {
                            image = image.startsWith('//') ? 'https:' + image : SHOPEE_BASE_URL + image;
                        }
                        
                        let url = $el.find('a').attr('href') || '';
                        if (url && !url.startsWith('http')) {
                            url = url.startsWith('/') ? SHOPEE_BASE_URL + url : SHOPEE_BASE_URL + '/' + url;
                        }

                        // Log para debug dos primeiros produtos
                        if (i < 3) {
                            console.log(`Produto ${i + 1}:`);
                            console.log(`  Título: ${title ? '✅' : '❌'} "${title}"`);
                            console.log(`  Preço: ${price ? '✅' : '❌'} "${price}"`);
                            console.log(`  Imagem: ${image ? '✅' : '❌'} "${image?.substring(0, 50)}..."`);
                            console.log(`  URL: ${url ? '✅' : '❌'} "${url?.substring(0, 50)}..."`);
                        }

                        if (title && url) {
                            allProducts.push({
                                title: title.substring(0, 100), // Limitar título
                                price: price || 'Consulte o preço',
                                image: image || 'https://via.placeholder.com/200x200?text=Sem+Imagem',
                                url: url,
                                discount: '' // Shopee não sempre mostra desconto facilmente
                            });
                        }
                    });
                    
                    foundProducts = true;
                    break; // Se encontrou produtos com um seletor, não precisa testar os outros
                }
            }

            if (!foundProducts) {
                console.log(`⚠️  Nenhum produto encontrado na página ${page + 1}`);
                // Salvar HTML para debug
                fs.writeFileSync(`debug_page_${page}.html`, html);
                console.log(`📁 HTML da página ${page} salvo em debug_page_${page}.html para análise`);
            }

            // Aguardar entre requisições
            await sleep(3000 + Math.random() * 2000);

        } catch (error) {
            console.error(`❌ Erro na página ${page}:`, error.message);
        }
    }

    console.log(`🎉 Total de produtos coletados: ${allProducts.length}`);
    return allProducts.slice(0, PRODUCTS_LIMIT);
}

// Função de fallback com produtos exemplo
function getFallbackProducts() {
    return [
        {
            title: "Smartphone Android 128GB - Oferta Especial",
            price: "R$ 299,90",
            image: "https://via.placeholder.com/200x200/FF6B35/FFFFFF?text=📱+Smartphone",
            url: "https://shopee.com.br",
            discount: "50% OFF"
        },
        {
            title: "Fone de Ouvido Bluetooth Premium", 
            price: "R$ 89,90",
            image: "https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=🎧+Fone",
            url: "https://shopee.com.br",
            discount: "30% OFF"
        },
        {
            title: "Power Bank 10000mAh Carregamento Rápido",
            price: "R$ 45,90",
            image: "https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=🔋+Power+Bank",
            url: "https://shopee.com.br", 
            discount: "25% OFF"
        },
        {
            title: "Cabo USB-C 2 Metros Resistente",
            price: "R$ 19,90",
            image: "https://via.placeholder.com/200x200/96CEB4/FFFFFF?text=🔌+Cabo",
            url: "https://shopee.com.br",
            discount: "40% OFF"
        },
        {
            title: "Película de Vidro Temperado 9H",
            price: "R$ 12,90", 
            image: "https://via.placeholder.com/200x200/FFEAA7/FFFFFF?text=📱+Película",
            url: "https://shopee.com.br",
            discount: "35% OFF"
        }
    ];
}

async function main() {
    try {
        console.log('🚀 Iniciando processo de scraping...');
        
        let products = await scrapeShopee();
        
        // Se não conseguiu produtos, usar fallback
        if (products.length === 0) {
            console.log('⚠️  Nenhum produto encontrado no scraping');
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
            source: products.length > 0 && products[0].url.includes('placeholder') ? 'fallback' : 'scraping'
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        console.log(`✅ Arquivo products.json salvo com ${products.length} produtos!`);
        console.log(`📅 Última atualização: ${lastUpdate}`);
        console.log(`📊 Fonte dos dados: ${data.source}`);

        // Log do arquivo criado
        const fileSize = fs.statSync('products.json').size;
        console.log(`📁 Tamanho do arquivo: ${fileSize} bytes`);

    } catch (error) {
        console.error('❌ Erro no scraping:', error);
        
        // Em caso de erro, criar arquivo com produtos de exemplo
        const fallbackData = {
            lastUpdate: new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            products: getFallbackProducts(),
            totalProducts: 5,
            scrapedAt: new Date().toISOString(),
            source: 'fallback-error',
            error: error.message
        };
        
        fs.writeFileSync('products.json', JSON.stringify(fallbackData, null, 2));
        console.log('📁 Arquivo de fallback criado devido ao erro');
        console.log('⚠️  O sistema continuará funcionando com produtos de exemplo');
        
        // Não encerrar o processo com erro, para permitir que o sistema continue
        // process.exit(1);
    }
}

// Executar apenas se este arquivo for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}