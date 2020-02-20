
import {core, API_EXTENSIONS_KEY} from '@sfcc-core/core';
import { resolverFactory,dataSourcesFactory } from "@sfcc-core/core-graphql";
import apolloServerCore from 'apollo-server-core';
import CommerceSdk from 'commerce-sdk';
import Image from '../../../@sfcc-bff/productapi/src/api/models/Image';

const { gql } = apolloServerCore;

//
// Define the Promotion extension to the Product object
//
const productRecommendationTypeDef = gql`
    type Recommendation {
        productId: String
        productName: String
        image: Image
    }
    extend type Product {
        recommendations: [Recommendation]
    }
`;


//
// Resolve the recommendation for a Product
//
const productRecommendationResolver = (config) => {
    return {
        Product: {
            recommendations: async (product) => {
                if (product.recommendations) {
                    return Promise.all(product.recommendations.map( async recommendation => {
                        const apiProduct = await getClientProduct(config, recommendation.recommendedItemId);
                            const myImage = apiProduct.imageGroups[2];
                            const tempImage = myImage.images[0];
                            return {productId: apiProduct.id, productName:apiProduct.name, image: new Image(tempImage)};
                        })
                    )
                }
            }
        }
    }
}

const getClientProduct = async (config, id) => {
    const clientId = config.COMMERCE_CLIENT_CLIENT_ID;
    const organizationId = config.COMMERCE_CLIENT_ORGANIZATION_ID;
    const shortCode = config.COMMERCE_CLIENT_SHORT_CODE;
    const siteId = config.COMMERCE_CLIENT_API_SITE_ID;

    const token = await CommerceSdk.helpers.getAuthToken({
        parameters: {
            clientId: clientId,
            organizationId: organizationId,
            shortCode: shortCode,
            siteId: siteId,
        },
        body: {
            type: 'guest',
        },
    });

    const product = new CommerceSdk.Product.ShopperProducts.Client({
        headers: { authorization: token.getBearerHeader() },
        parameters: {
            organizationId: organizationId,
            shortCode: shortCode,
            siteId: siteId,
        },
    });

    return product
        .getProduct({
            parameters: {
                id: id,
                allImages: true,
            },
        }).then(productResponse => {
            return productResponse;
        })
        .catch(e => {
            logger.error(`Error in getClientProduct() for product ${id}`);
            throw e;
        });
};



//
// Extension registration
//

export default class ProductDetailExtensions {

    getDataSources(config) {
        core.logger.log('===========================');
        core.logger.log('===========================');
        core.logger.log('ProductAPI.getDataSources()', config);
        core.logger.log('===========================');
        core.logger.log('===========================');
        return dataSourcesFactory(config, []);
    };

    get typeDefs() {
        return [productRecommendationTypeDef];
    }

    getResolvers(config) {
        return resolverFactory(config,[productRecommendationResolver]);
    }
}

core.registerExtension(API_EXTENSIONS_KEY, function (config) {
    const extensions = new ProductDetailExtensions();
    return extensions;
});
