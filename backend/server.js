import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ID de afiliado (apenas Shopee)
const AFFILIATE_ID = '18369330491';

// URL do JSON com dados atualizados 
const PRODUCTS_URL = 'https://raw.githubusercontent.com/RiquelmeDevCoders/riquelme-ofertas/main/products.json';

// Produtos de fallback caso o arquivo não exista
function getFallbackProducts() {
    return [
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
        }
    ];
}

// Função para processar URLs com afiliado apenas no Shopee
function processAffiliateUrls(products) {
    return products.map(product => {
        try {
            if (!product.url || product.platform !== 'shopee') {
                return product;
            }
            
            const affiliateUrl = new URL(product.url);
            if (!affiliateUrl.searchParams.has('affiliate_id')) {
                affiliateUrl.searchParams.set('affiliate_id', AFFILIATE_ID);
            }
            
            return {
                ...product,
                url: affiliateUrl.toString()
            };
        } catch (error) {
            console.log(`⚠️ Erro ao processar URL do produto ${product.platform}:`, product.title);
            return product;
        }
    });
}

// Rota principal
app.get('/', async (req, res) => {
    try {
        console.log('📡 Fazendo requisição para:', PRODUCTS_URL);
        
        const response = await fetch(PRODUCTS_URL, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; OfertasBot/1.0)'
            }
        });
        
        let data = null;
        let usingFallback = false;
        
        if (!response.ok) {
            console.log(`⚠️ Erro ${response.status} - ${response.statusText}, usando fallback`);
            usingFallback = true;
        } else {
            try {
                data = await response.json();
                console.log('📦 Dados recebidos:', { 
                    products: data.products?.length || 0, 
                    lastUpdate: data.lastUpdate,
                    platforms: Object.keys(data.platforms || {}).join(', ')
                });
            } catch (parseError) {
                console.log('⚠️ Erro ao parsear JSON, usando fallback');
                usingFallback = true;
            }
        }

        // Se não conseguiu dados válidos ou não há produtos, usar fallback
        if (usingFallback || !data?.products || data.products.length === 0) {
            const fallbackProducts = getFallbackProducts();
            const processedProducts = processAffiliateUrls(fallbackProducts);
            
            console.log(`📦 Usando ${processedProducts.length} produtos de fallback`);
            
            return res.json({
                products: processedProducts,
                lastUpdate: new Date().toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo'
                }),
                totalProducts: processedProducts.length,
                platforms: {
                    shopee: 2,
                    mercadolivre: 2,
                    amazon: 2,
                    aliexpress: 2
                },
                hasAffiliateShopee: true,
                source: 'fallback',
                message: usingFallback ? 
                    'Arquivo products.json não encontrado. Usando produtos de exemplo.' :
                    'Dados atualizados não disponíveis. Exibindo produtos de exemplo.'
            });
        }

        // Processar produtos normalmente
        let processedProducts = processAffiliateUrls(data.products);
        
        processedProducts = processedProducts.filter(product => 
            product.title && 
            product.title.length > 5 && 
            product.url && 
            product.platform
        );

        console.log(`✅ Retornando ${processedProducts.length} produtos de ${Object.keys(data.platforms || {}).length} plataformas`);
        
        res.json({
            products: processedProducts,
            lastUpdate: data.lastUpdate || new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            totalProducts: processedProducts.length,
            platforms: data.platforms || {},
            hasAffiliateShopee: true,
            source: 'github',
            scraped: data.scrapedAt ? new Date(data.scrapedAt) : null
        });

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        
        // Em caso de erro crítico, sempre retornar fallback
        const fallbackProducts = getFallbackProducts();
        const processedProducts = processAffiliateUrls(fallbackProducts);
        
        res.status(200).json({
            products: processedProducts,
            lastUpdate: new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            totalProducts: processedProducts.length,
            platforms: {
                shopee: 2,
                mercadolivre: 2,
                amazon: 2,
                aliexpress: 2
            },
            hasAffiliateShopee: true,
            source: 'fallback-error',
            error: error.message,
            message: 'Erro na conexão. Exibindo produtos de exemplo.'
        });
    }
});

// Outras rotas...
app.get('/test', (req, res) => {
    console.log('🔍 Rota de teste acessada');
    res.json({ 
        message: 'Servidor multi-plataforma funcionando!', 
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        env: process.env.NODE_ENV || 'development',
        supportedPlatforms: ['shopee', 'mercadolivre', 'amazon', 'aliexpress'],
        affiliateEnabled: 'Apenas Shopee',
        productsUrl: PRODUCTS_URL
    });
});

app.get('/check-json', async (req, res) => {
    try {
        console.log('🔍 Verificando JSON em:', PRODUCTS_URL);
        const response = await fetch(PRODUCTS_URL, { timeout: 10000 });
        
        if (!response.ok) {
            return res.json({
                url: PRODUCTS_URL,
                status: response.status,
                statusText: response.statusText,
                ok: false,
                message: 'Arquivo não encontrado. Server usará produtos de fallback.'
            });
        }
        
        const data = await response.json();
        
        res.json({
            url: PRODUCTS_URL,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            hasProducts: !!(data.products && data.products.length > 0),
            productCount: data.products ? data.products.length : 0,
            platforms: data.platforms || {},
            lastUpdate: data.lastUpdate
        });
    } catch (error) {
        res.json({
            url: PRODUCTS_URL,
            error: error.message,
            ok: false,
            message: 'Erro ao verificar arquivo. Server usará produtos de fallback.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor multi-plataforma rodando na porta ${PORT}`);
    console.log(`📡 URL dos produtos: ${PRODUCTS_URL}`);
    console.log(`🌍 Node.js versão: ${process.version}`);
    console.log(`🏪 Plataformas suportadas: Shopee (com afiliado), Mercado Livre, Amazon, AliExpress`);
    console.log(`💰 Afiliado ativo apenas na Shopee: ${AFFILIATE_ID}`);
    console.log(`🔄 Fallback habilitado caso products.json não exista`);
});