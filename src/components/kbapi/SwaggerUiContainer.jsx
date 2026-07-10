import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function SwaggerUiContainer({ spec, plugins }) {
  return (
    <div className="swagger-ui-dark-wrapper">
      <SwaggerUI
        spec={spec}
        deepLinking={true}
        plugins={plugins}
      />
    </div>
  );
}