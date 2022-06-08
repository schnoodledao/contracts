// ReSharper disable InconsistentNaming
import React from 'react';
import { Container } from 'reactstrap';
import NavMenu from './NavMenu';
// ReSharper disable InconsistentNaming

const Layout = ({children}: React.PropsWithChildren<{}>) => {
  return (
    <div className="">
      <NavMenu />
      <Container>
        {children}
      </Container>
    </div>
  );
}

Layout.displayName = Layout.name;
export default Layout;
