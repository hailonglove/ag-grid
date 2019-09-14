var columnDefs = [
    {
        headerName: 'Athlete',
        children: [
            { field: "athlete", width: 150, filter: 'agTextColumnFilter'},
            { field: "age", width: 90},
            { field: "country", width: 120}
        ]
    },
    {
        headerName: 'Competition',
        children: [
            { field: "year", width: 90 },
            { field: "date", width: 110 },
        ]
    },
    { field: "sport", width: 110 },
    {
        headerName: 'Medals',
        children: [
            { field: "gold", width: 100 },
            { field: "silver", width: 100 },
            { field: "bronze", width: 100 },
            { field: "total", width: 100 }
        ]
    }
];

var gridOptions = {
    defaultColDef: {
        // allow every column to be aggregated
        enableValue: true,
        // allow every column to be grouped
        enableRowGroup: true,
        // allow every column to be pivoted
        enablePivot: true,
        sortable: true,
        filter: true
    },
    columnDefs: columnDefs,
    sideBar: 'filters',
    onGridReady: function(params) {
        params.api.getToolPanelInstance('filters').expandFilters();
    }
};

function collapseAllFilters() {
    gridOptions.api.getToolPanelInstance('filters').collapseFilters();
}

function expandAllFilters() {
    gridOptions.api.getToolPanelInstance('filters').expandFilters();
}

function collapseAgeFilter() {
    gridOptions.api.getToolPanelInstance('filters').collapseFilters(['age']);
}

function expandAgeFilter() {
    gridOptions.api.getToolPanelInstance('filters').expandFilters(['age']);
}

// setup the grid after the page has finished loading
document.addEventListener('DOMContentLoaded', function () {
    var gridDiv = document.querySelector('#myGrid');
    new agGrid.Grid(gridDiv, gridOptions);

    // do http request to get our sample data - not using any framework to keep the example self contained.
    // you will probably use a framework like JQuery, Angular or something else to do your HTTP calls.
    var httpRequest = new XMLHttpRequest();
    httpRequest.open('GET', 'https://raw.githubusercontent.com/ag-grid/ag-grid/master/packages/ag-grid-docs/src/olympicWinners.json');
    httpRequest.send();
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var httpResult = JSON.parse(httpRequest.responseText);
            gridOptions.api.setRowData(httpResult);
        }
    };
});
