 // URL do backend hospedado no Render
        const BACKEND_URL = 'https://riquelme-ofertas.onrender.com';
        
        async function loadProducts() {
            try {
                const response = await fetch(BACKEND_URL);
                const { products, lastUpdate } = await response.json();
                
                if (!products || products.length === 0) {
                    throw new Error('Nenhum produto encontrado');
                }
                
                document.getElementById('update-date').textContent = lastUpdate;
                
                const productsContainer = document.getElementById('products-container');
                productsContainer.innerHTML = '';
                
                products.forEach(product => {
                    const productCard = document.createElement('div');
                    productCard.className = 'product-card';
                    productCard.innerHTML = `
                        <img src="${product.image}" alt="${product.title}" class="product-image">
                        <div class="product-info">
                            <h3 class="product-title">${product.title}</h3>
                            <div class="product-price">${product.price}</div>
                            ${product.discount ? <span class="product-discount">${product.discount} OFF</span> : ''}
                            <a href="${product.url}" target="_blank" class="affiliate-btn">
                                Ver Oferta <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    `;
                    productsContainer.appendChild(productCard);
                });
                
            } catch (error) {
                console.error('Erro ao carregar produtos:', error);
                document.getElementById('products-container').innerHTML = `
                    <div class="error">
                        <p>Ocorreu um erro ao carregar as ofertas. Por favor, tente novamente mais tarde.</p>
                    </div>
                `;
            }
        }
        
        // Carregar produtos quando a página carregar
        document.addEventListener('DOMContentLoaded', loadProducts);
        
        // Atualizar a cada 10 minutos
        setInterval(loadProducts, 600000);