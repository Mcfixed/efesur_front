import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class MapErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Suprimir errores de Mapbox GL específicamente
    if (
      error.message?.includes('Cannot read properties of undefined') ||
      error.message?.includes('updateTerrain')
    ) {
      console.warn('[MapErrorBoundary] Suppressed Mapbox GL terrain error');
      return { hasError: false }; // No mostrar error boundary, solo loguearlo
    }
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (
      error.message?.includes('Cannot read properties of undefined') ||
      error.message?.includes('updateTerrain')
    ) {
      console.warn('[MapErrorBoundary] Mapbox GL error caught and suppressed:', error);
      // No propagar el error
    } else {
      console.error('[MapErrorBoundary] Error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return <div>Error al cargar el mapa</div>;
    }

    return this.props.children;
  }
}
