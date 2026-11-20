// A c-number label is a unit purchase cost, never an inventory identity.
function ebayLabelCost(value) {
  const match=/^c(\d{1,7})(?:\.(\d{1,2}))?$/i.exec(String(value || '').trim());
  return match?(Number(match[1])*100+Number((match[2] || '').padEnd(2,'0')))/100:null;
}
(() => {
  function decorate(planned,source) {
    return planned.map((row,index)=>{
      row.sku=String(source[index]['Custom label (SKU)'] || '').trim();
      const cost=ebayLabelCost(row.sku);
      if(cost==null || !['new','update'].includes(row.state))return row;
      const unit='$'+cost.toFixed(2)+' per item';
      const existing=row.expected;
      const m=existing?metadata(existing.notes):{};
      if(existing && (Number(existing.purchase_price || 0)!==0 || m.purchaseCostConfirmed===true || m.purchaseCostUnknown===false))
        row.reason+='; saved COG kept (eBay label: '+unit+')';
      else if(existing && (m.stockLots || existing.quantity!==existing.quantity_remaining))
        row.reason+='; COG label '+unit+' needs review because this item has purchase/sale history';
      else row.reason=row.reason.replace(/; purchase cost unknown|; preserve costs, photos and stock|; keep cost, asking price, photos and stock/g,'')+
        '; import COG '+unit+' ($'+(cost*Number(existing?.quantity ?? row.available)).toFixed(2)+' total); keep photos and stock';
      return row;
    });
  }
  const active=ebayPlanImport;
  ebayPlanImport=function(source,inventory){return decorate(active(source.map(row=>({...row,'Custom label (SKU)':''})),inventory),source);};
  const inactive=ebayInactivePlan;
  ebayInactivePlan=function(source,inventory){return decorate(inactive(source.map(row=>({...row,'Custom label (SKU)':''})),inventory),source);};
  if(typeof salesMakePreview==='function'){
    const sales=salesMakePreview;
    salesMakePreview=function(orderText,paymentText,vendooText,inventory,existingSales){
      return sales(orderText,paymentText,vendooText,inventory,existingSales).map(row=>{
        const cost=ebayLabelCost(row.sku);
        if(cost==null || row.purchaseCost!=null || !row.paymentsMatched || ['blocked','duplicate'].includes(row.state))return row;
        const linked=inventory.filter(item=>ebayListingId(item)===row.listingId);
        if(linked.length>1)return row;
        if(linked.length===1){const item=linked[0],m=metadata(item.notes);
          if(Number(item.purchase_price || 0)!==0 || m.purchaseCostConfirmed===true || m.purchaseCostUnknown===false || m.stockLots)return row;}
        row.purchaseCost=Math.round(cost*100)*row.quantity/100;
        row.purchaseCostSource='eBay cost label '+row.sku+': $'+cost.toFixed(2)+' per item × '+row.quantity;
        row.reason+='; '+row.purchaseCostSource;
        return row;
      });
    };
  }
})();
