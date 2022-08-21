// ReSharper disable InconsistentNaming
import React from 'react';
import { Container } from 'reactstrap';
import NavMenu from './NavMenu';
// ReSharper disable InconsistentNaming

export interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<any> = (props: LayoutProps) => (
  <div>
    <NavMenu />
    <Container>
      {props.children}
    </Container>
  </div>
);

Layout.displayName = Layout.name;
export default Layout;
