import { CustomCellRendererProps } from '@ag-grid-community/react';
import React from 'react';

export default ({ data }: CustomCellRendererProps) => {
    return (
        <div className="custom-element">
            <button>Age: {data.age ? data.age : '?'}</button>
            <input defaultValue={data.country ? data.country : ''} />
            <a href={`https://www.google.com/search?q=${data.sport}`} target="_blank">
                {data.sport}
            </a>
        </div>
    );
};
