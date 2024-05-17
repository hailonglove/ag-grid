import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { GridApi, GridOptions, createGrid } from '@ag-grid-community/core';
import { ModuleRegistry } from '@ag-grid-community/core';
import { ClipboardModule } from '@ag-grid-enterprise/clipboard';
import { ExcelExportModule } from '@ag-grid-enterprise/excel-export';
import { MenuModule } from '@ag-grid-enterprise/menu';
import { RangeSelectionModule } from '@ag-grid-enterprise/range-selection';
import { RowGroupingModule } from '@ag-grid-enterprise/row-grouping';
import { SetFilterModule } from '@ag-grid-enterprise/set-filter';

ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ClipboardModule,
    ExcelExportModule,
    MenuModule,
    RangeSelectionModule,
    RowGroupingModule,
    SetFilterModule,
]);

interface IOlympicDataTypes extends IOlympicData {
    dateObject: Date;
    hasGold: boolean;
    hasSilver: boolean;
    countryObject: {
        name: string;
    };
}

let gridApi: GridApi<IOlympicDataTypes>;

const gridOptions: GridOptions<IOlympicDataTypes> = {
    columnDefs: [
        { field: 'athlete' },
        { field: 'age', minWidth: 100 },
        { field: 'hasGold', minWidth: 100, headerName: 'Gold' },
        { field: 'hasSilver', minWidth: 100, headerName: 'Silver', cellRendererParams: { disabled: true } },
        { field: 'dateObject', headerName: 'Date' },
        { field: 'date', headerName: 'Date (String)' },
        { field: 'countryObject', headerName: 'Country' },
    ],
    defaultColDef: {
        flex: 1,
        minWidth: 180,
        filter: true,
        floatingFilter: true,
        editable: true,
        enableRowGroup: true,
    },
    dataTypeDefinitions: {
        object: {
            baseDataType: 'object',
            extendsDataType: 'object',
            valueParser: (params) => ({ name: params.newValue }),
            valueFormatter: (params) => (params.value == null ? '' : params.value.name),
        },
    },
    enableFillHandle: true,
    enableRangeSelection: true,
    rowGroupPanelShow: 'always',
};

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector<HTMLElement>('#myGrid')!;
    gridApi = createGrid(gridDiv, gridOptions);

    fetch('https://www.ag-grid.com/example-assets/olympic-winners.json')
        .then((response) => response.json())
        .then((data: IOlympicDataTypes[]) =>
            gridApi!.setGridOption(
                'rowData',
                data.map((rowData) => {
                    const dateParts = rowData.date.split('/');
                    return {
                        ...rowData,
                        date: `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`,
                        dateObject: new Date(
                            parseInt(dateParts[2]),
                            parseInt(dateParts[1]) - 1,
                            parseInt(dateParts[0])
                        ),
                        countryObject: {
                            name: rowData.country,
                        },
                        hasGold: rowData.gold > 0,
                        hasSilver: rowData.silver > 0,
                    };
                })
            )
        );
});
