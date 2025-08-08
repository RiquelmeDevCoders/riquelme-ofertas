import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { addUpdaterRoutes } from './auto-updater.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AFFILIATE_ID = '18369330491';
const PRODUCTS_URL = 'https://raw.githubusercontent.com/RiquelmeDevCoders/riquelme-ofertas/main/products.json';

let cachedProducts = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function processAffiliateUrls(products) {
    return products.map(product => {
        if (product.platform !== 'shopee' || !product.url) return product;
        
        try {
            const affiliateUrl = new URL(product.url);
            if (!affiliateUrl.searchParams.has('affiliate_id')) {
                affiliateUrl.searchParams.set('affiliate_id', AFFILIATE_ID);
            }
            return { ...product, url: affiliateUrl.toString() };
        } catch (error) {
            return product;
        }
    });
}

function getRealtimeFallback() {
    const now = new Date();
    const prices = ['89,90', '149,90', '299,00', '459,90', '699,00', '1.299,00'];
    const discounts = ['25%', '35%', '45%', '50%', '60%', '70%'];
    
    return [
        {
            title: "Samsung Galaxy A54 5G 128GB",
            price: `R$ ${prices[Math.floor(Math.random() * 3)]}`,
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=Galaxy+A54",
            url: `https://shopee.com.br/galaxy-a54?affiliate_id=${AFFILIATE_ID}`,
            discount: `${discounts[Math.floor(Math.random() * discounts.length)]} OFF`,
            platform: "shopee"
        },
        {
            title: "JBL Tune 510BT Bluetooth",
            price: `R$ ${prices[Math.floor(Math.random() * 2)]}`,
            image: "https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=JBL+510BT",
            url: `https://shopee.com.br/jbl-tune-510bt?affiliate_id=${AFFILIATE_ID}`,
            discount: `${discounts[Math.floor(Math.random() * discounts.length)]} OFF`,
            platform: "shopee"
        },
        {
            title: "iPhone 14 128GB Azul",
            price: `R$ ${prices[Math.floor(Math.random() * 3) + 3]}`,
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=iPhone+14",
            url: "https://mercadolivre.com.br/iphone-14-azul",
            discount: `${discounts[Math.floor(Math.random() * 3)]} OFF`,
            platform: "mercadolivre"
        },
        {
            title: "Xiaomi Redmi Note 12 Pro",
            price: `R$ ${prices[Math.floor(Math.random() * 4) + 2]}`,
            image: "https://via.placeholder.com/300x300/FFE500/000000?text=Redmi+Note+12",
            url: "https://mercadolivre.com.br/redmi-note-12-pro",
            discount: `${discounts[Math.floor(Math.random() * discounts.length)]} OFF`,
            platform: "mercadolivre"
        },
        {
            title: "Echo Dot 5ª Geração Alexa",
            price: `R$ ${prices[Math.floor(Math.random() * 2)]}`,
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=Echo+Dot+5",
            url: "https://amazon.com.br/echo-dot-5-geracao",
            discount: `${discounts[Math.floor(Math.random() * 4)]} OFF`,
            platform: "amazon"
        },
        {
            title: "Fire TV Stick 4K Max",
            price: `R$ ${prices[Math.floor(Math.random() * 3) + 1]}`,
            image: "https://via.placeholder.com/300x300/FF9900/FFFFFF?text=Fire+TV+4K",
            url: "https://amazon.com.br/fire-tv-stick-4k-max",
            discount: `${discounts[Math.floor(Math.random() * discounts.length)]} OFF`,
            platform: "amazon"
        }
    ].map(product => ({ ...product, scraped_at: now.toISOString() }));
}

async function fetchProducts() {
    const now = Date.now();
    
    // Usar cache se ainda válido
    if (cachedProducts && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('📋 Usando cache válido');
        return cachedProducts;
    }
    
    try {
        console.log('📡 Buscando produtos atualizados...');
        
        const response = await fetch(PRODUCTS_URL, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OfertasBot/1.0)' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.products && data.products.length > 0) {
            const processedProducts = processAffiliateUrls(data.products);
            
            cachedProducts = {
                products: processedProducts,
                lastUpdate: data.lastUpdate || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                totalProducts: processedProducts.length,
                platforms: data.platforms || {},
                hasAffiliateShopee: true,
                source: 'github'
            };
            cacheTimestamp = now;
            
            console.log(`✅ ${processedProducts.length} produtos carregados do GitHub`);
            return cachedProducts;
        }
        
    } catch (error) {
        console.log('⚠️ Erro ao buscar do GitHub:', error.message);
    }
    
    // Fallback dinâmico
    console.log('📦 Usando produtos de fallback dinâmicos');
    const fallbackProducts = getRealtimeFallback();
    const processedProducts = processAffiliateUrls(fallbackProducts);
    
    const fallbackData = {
        products: processedProducts,
        lastUpdate: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        totalProducts: processedProducts.length,
        platforms: { shopee: 2, mercadolivre: 2, amazon: 2 },
        hasAffiliateShopee: true,
        source: 'fallback-dynamic'
    };
    
    cachedProducts = fallbackData;
    cacheTimestamp = now;
    
    return fallbackData;
}

// Rota principal otimizada
app.get('/', async (req, res) => {
    try {
        const data = await fetchProducts();
        res.json(data);
    } catch (error) {
        console.error('❌ Erro crítico:', error.message);
        res.status(500).json({
            error: error.message,
            products: getRealtimeFallback(),
            source: 'emergency-fallback',
            message: 'Erro temporário. Produtos de emergência exibidos.'
        });
    }
});

// Rota para limpar cache
app.post('/cache/clear', (req, res) => {
    cachedProducts = null;
    cacheTimestamp = null;
    console.log('🗑️ Cache limpo');
    res.json({ message: 'Cache limpo com sucesso' });
});

// Rota de busca
app.get('/search', async (req, res) => {
    const query = req.query.q?.toLowerCase();
    
    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Query deve ter pelo menos 2 caracteres' });
    }
    
    try {
        const data = await fetchProducts();
        const filteredProducts = data.products.filter(product => 
            product.title.toLowerCase().includes(query) ||
            product.platform.toLowerCase().includes(query)
        );
        
        res.json({
            ...data,
            products: filteredProducts,
            totalProducts: filteredProducts.length,
            searchQuery: query
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota por plataforma
app.get('/platform/:platform', async (req, res) => {
    const platform = req.params.platform.toLowerCase();
    
    try {
        const data = await fetchProducts();
        const platformProducts = data.products.filter(product => 
            product.platform === platform
        );
        
        res.json({
            ...data,
            products: platformProducts,
            totalProducts: platformProducts.length,
            selectedPlatform: platform
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota de teste melhorada
app.get('/test', (req, res) => {
    const uptime = Math.floor(process.uptime());
    res.json({
        status: 'online',
        message: 'Servidor funcionando!',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 60)}min ${uptime % 60}s`,
        nodeVersion: process.version,
        platform: process.platform,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        cache: {
            hasCache: !!cachedProducts,
            cacheAge: cacheTimestamp ? Math.floor((Date.now() - cacheTimestamp) / 1000) : 0
        },
        supportedPlatforms: ['shopee', 'mercadolivre', 'amazon'],
        affiliateEnabled: 'Shopee apenas',
        productsUrl: PRODUCTS_URL
    });
});

// Adicionar rotas do updater
addUpdaterRoutes(app);

// Middleware de erro global
app.use((err, req, res, next) => {
    console.error('❌ Erro não capturado:', err.message);
    res.status(500).json({
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
    });
});

// Pré-carregar cache na inicialização
async function initializeServer() {
    console.log('🚀 Inicializando servidor...');
    try {
        await fetchProducts();
        console.log('✅ Cache inicial carregado');
    } catch (error) {
        console.log('⚠️ Falha ao carregar cache inicial:', error.message);
    }
}

app.listen(PORT, async () => {
    console.log(`🌐 Servidor rodando na porta ${PORT}`);
    console.log(`📡 URL dos produtos: ${PRODUCTS_URL}`);
    console.log(`🏪 Plataformas: Shopee (afiliado), Mercado Livre, Amazon`);
    console.log(`💰 ID do afiliado: ${AFFILIATE_ID}`);
    console.log(`⏰ Cache: ${CACHE_DURATION / 1000}s`);
    
    await initializeServer();
    
    // Auto-refresh do cache a cada 10 minutos
    setInterval(async () => {
        console.log('🔄 Atualizando cache automaticamente...');
        try {
            cacheTimestamp = null; // Forçar atualização
            await fetchProducts();
        } catch (error) {
            console.log('⚠️ Erro na atualização automática:', error.message);
        }
    }, 10 * 60 * 1000);
});