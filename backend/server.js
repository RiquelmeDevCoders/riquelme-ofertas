import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ID de afiliado
const AFFILIATE_ID = '18369330491';

// URL do JSON com dados atualizados 
const PRODUCTS_URL = 'https://raw.githubusercontent.com/RiquelmeDevCoders/riquelme-ofertas/main/products.json';

// Rota principal (corrigindo para corresponder ao frontend)
app.get('/', async (req, res) => {
    try {
        console.log('📡 Fazendo requisição para:', PRODUCTS_URL);
        
        const response = await fetch(PRODUCTS_URL);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar produtos: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', { 
            products: data.products?.length || 0, 
            lastUpdate: data.lastUpdate 
        });

        // Verificar se existem produtos
        if (!data.products || data.products.length === 0) {
            console.log('⚠️ Nenhum produto encontrado, retornando array vazio');
            return res.json({
                products: [],
                lastUpdate: new Date().toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo'
                }),
                message: 'Nenhum produto disponível no momento'
            });
        }

        // Adicionar ID de afiliado aos URLs (se necessário)
        const productsWithAffiliate = data.products.map(product => {
            try {
                if (!product.url) return product;
                
                const affiliateUrl = new URL(product.url);
                affiliateUrl.searchParams.set('affiliate_id', AFFILIATE_ID);
                return {
                    ...product,
                    url: affiliateUrl.toString()
                };
            } catch (error) {
                console.log('⚠️ Erro ao processar URL do produto:', product.title);
                return product;
            }
        });

        console.log(`✅ Retornando ${productsWithAffiliate.length} produtos`);
        
        res.json({
            products: productsWithAffiliate,
            lastUpdate: data.lastUpdate || new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            totalProducts: productsWithAffiliate.length
        });

    } catch (error) {
        console.error('❌ Erro ao obter produtos:', error.message);
        
        // Retornar resposta mesmo com erro para não quebrar o frontend
        res.status(200).json({ 
            error: 'Erro ao carregar produtos',
            products: [],
            lastUpdate: new Date().toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo'
            }),
            message: 'Não foi possível carregar os produtos no momento. Tente novamente mais tarde.'
        });
    }
});

// Rota adicional para /produtos (mantendo compatibilidade)
app.get('/produtos', async (req, res) => {
    req.url = '/';
    app._router.handle(req, res);
});

// Rota de teste
app.get('/test', (req, res) => {
    console.log('🔍 Rota de teste acessada');
    res.json({ 
        message: 'Servidor funcionando!', 
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        env: process.env.NODE_ENV || 'development'
    });
});

// Rota para verificar se o arquivo JSON existe
app.get('/check-json', async (req, res) => {
    try {
        console.log('🔍 Verificando JSON em:', PRODUCTS_URL);
        const response = await fetch(PRODUCTS_URL);
        
        res.json({
            url: PRODUCTS_URL,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
    } catch (error) {
        res.json({
            url: PRODUCTS_URL,
            error: error.message,
            ok: false
        });
    }
});

// Middleware para capturar erros não tratados
app.use((error, req, res, next) => {
    console.error('❌ Erro não tratado:', error);
    res.status(500).json({
        error: 'Erro interno do servidor',
        products: [],
        lastUpdate: new Date().toLocaleString('pt-BR')
    });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    console.log(`🔍 Rota não encontrada: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Rota não encontrada',
        availableRoutes: ['/', '/produtos', '/test', '/check-json']
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 URL dos produtos: ${PRODUCTS_URL}`);
    console.log(`🌍 Node.js versão: ${process.version}`);
});