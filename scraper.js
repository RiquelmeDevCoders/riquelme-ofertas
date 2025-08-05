const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Configurações
const SHOPEE_BASE_URL = 'https://shopee.com.br';
const SEARCH_URL = 'https://shopee.com.br/search?keyword=oferta&page=';
const MAX_PAGES = 2;
const PRODUCTS_LIMIT = 20;

// Headers para simular um navegador real
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
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
            const response = await fetch(url, { headers: HEADERS });
            
            if (!response.ok) {
                console.log(`❌ Erro HTTP ${response.status} na página ${page}`);
                continue;
            }
            
            const html = await response.text();
            const $ = cheerio.load(html);

            // Diferentes seletores que a Shopee pode usar
            const possibleSelectors = [
                '.shopee-search-item-result__item',
                '.col-xs-2-4',
                '[data-sqe="item"]',
                '.item-card-special',
                '.shopee-item-card'
            ];

            let foundProducts = false;

            for (const selector of possibleSelectors) {
                const items = $(selector);
                if (items.length > 0) {
                    console.log(`✅ Encontrados ${items.length} itens com seletor: ${selector}`);
                    
                    items.each((i, el) => {
                        if (allProducts.length >= PRODUCTS_LIMIT) return;

                        const $el = $(el);
                        
                        // Tentar diferentes seletores para cada campo
                        const title = $el.find('.ie3A+- div, ._10Wbs- div, [data-sqe="name"]').first().text().trim() ||
                                     $el.find('img').attr('alt') || '';
                        
                        const price = $el.find('.ZEgARZ, ._3c5u7X, [data-sqe="price"]').first().text().trim() ||
                                     $el.find('.price').first().text().trim() || '';
                        
                        let image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
                        if (image && !image.startsWith('http')) {
                            image = image.startsWith('//') ? 'https:' + image : SHOPEE_BASE_URL + image;
                        }
                        
                        let url = $el.find('a').attr('href') || '';
                        if (url && !url.startsWith('http')) {
                            url = url.startsWith('/') ? SHOPEE_BASE_URL + url : SHOPEE_BASE_URL + '/' + url;
                        }

                        // Log para debug
                        if (i < 3) {
                            console.log(`Produto ${i + 1}: ${title ? '✅' : '❌'} título, ${price ? '✅' : '❌'} preço, ${image ? '✅' : '❌'} imagem, ${url ? '✅' : '❌'} url`);
                        }

                        if (title && (price || image) && url) {
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
                // Salvar HTML para debug (opcional)
                // fs.writeFileSync(`debug_page_${page}.html`, html);
            }

            // Aguardar entre requisições
            await sleep(2000 + Math.random() * 3000);

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
            title: "Produto Exemplo 1 - Smartphone Android",
            price: "R$ 299,90",
            image: "https://via.placeholder.com/200x200?text=Smartphone",
            url: "https://shopee.com.br",
            discount: "50% OFF"
        },
        {
            title: "Produto Exemplo 2 - Fone Bluetooth",
            price: "R$ 89,90", 
            image: "https://via.placeholder.com/200x200?text=Fone",
            url: "https://shopee.com.br",
            discount: "30% OFF"
        },
        {
            title: "Produto Exemplo 3 - Power Bank 10000mAh",
            price: "R$ 45,90",
            image: "https://via.placeholder.com/200x200?text=Power+Bank", 
            url: "https://shopee.com.br",
            discount: "25% OFF"
        }
    ];
}

async function main() {
    try {
        let products = await scrapeShopee();
        
        // Se não conseguiu produtos, usar fallback
        if (products.length === 0) {
            console.log('⚠️  Usando produtos de exemplo (fallback)');
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
            totalProducts: products.length
        };

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));
        console.log(`✅ Arquivo products.json salvo com ${products.length} produtos!`);
        console.log(`📅 Última atualização: ${lastUpdate}`);

    } catch (error) {
        console.error('❌ Erro no scraping:', error);
        
        // Em caso de erro, criar arquivo com produtos de exemplo
        const fallbackData = {
            lastUpdate: new Date().toLocaleString('pt-BR'),
            products: getFallbackProducts(),
            totalProducts: 3
        };
        
        fs.writeFileSync('products.json', JSON.stringify(fallbackData, null, 2));
        console.log('📁 Arquivo de fallback criado');
        process.exit(1);
    }
}

main();