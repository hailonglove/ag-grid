// ag-grid-enterprise v19.0.0
import { MenuItemDef, Column } from 'ag-grid-community';
export declare class MenuItemMapper {
    private gridOptionsWrapper;
    private columnController;
    private gridApi;
    private clipboardService;
    private aggFuncService;
    mapWithStockItems(originalList: (MenuItemDef | string)[], column: Column): (MenuItemDef | string)[];
    private getStockMenuItem;
    private createAggregationSubMenu;
}
