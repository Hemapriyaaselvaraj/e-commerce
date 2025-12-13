/**
 * Centralized offer calculation utility
 * Ensures consistent offer calculation across all controllers
 */

const calculateBestOffer = (product, activeOffers) => {
  let maxOfferDiscount = 0;
  let appliedOfferType = 'None';
  let appliedOfferName = '';

  if (!product || !activeOffers || activeOffers.length === 0) {
    return {
      discountPercentage: 0,
      appliedOfferType: 'None',
      appliedOfferName: '',
      finalPrice: product ? product.price : 0
    };
  }

  // 1. Check Product-specific offers
  const productOffers = activeOffers.filter(offer => 
    offer.product && offer.product.length > 0 &&
    offer.product.some(prodId => prodId.toString() === product._id.toString())
  );
  
  productOffers.forEach(offer => {
    if (offer.discountPercentage > maxOfferDiscount) {
      maxOfferDiscount = offer.discountPercentage;
      appliedOfferType = 'Product Offer';
      appliedOfferName = offer.name || offer._id.toString();
    }
  });

  // 2. Check Category offers
  const categoryOffers = activeOffers.filter(offer => 
    offer.category && offer.category.length > 0 &&
    offer.category.some(cat => cat && cat.category === product.product_category)
  );
  
  categoryOffers.forEach(offer => {
    if (offer.discountPercentage > maxOfferDiscount) {
      maxOfferDiscount = offer.discountPercentage;
      appliedOfferType = 'Category Offer';
      appliedOfferName = offer.name || offer._id.toString();
    }
  });

  // 3. Check General offers (apply to all products)
  const generalOffers = activeOffers.filter(offer => 
    (!offer.product || offer.product.length === 0) && 
    (!offer.category || offer.category.length === 0)
  );
  
  generalOffers.forEach(offer => {
    if (offer.discountPercentage > maxOfferDiscount) {
      maxOfferDiscount = offer.discountPercentage;
      appliedOfferType = 'General Offer';
      appliedOfferName = offer.name || offer._id.toString();
    }
  });

  // Calculate final price
  const finalPrice = maxOfferDiscount > 0 
    ? product.price * (1 - maxOfferDiscount / 100)
    : product.price;

  return {
    discountPercentage: maxOfferDiscount,
    appliedOfferType,
    appliedOfferName,
    finalPrice,
    originalPrice: product.price
  };
};

module.exports = {
  calculateBestOffer
};