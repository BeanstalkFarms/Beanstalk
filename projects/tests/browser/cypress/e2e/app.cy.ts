import { NavbarItem } from "../types";

describe("app", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("has has accurate slugs and navigates properly", () => {
    cy.fixture("navbar.json").then((nav) => {
      for (const item of nav.fields as NavbarItem[]) {
        cy.wait(300).then(async () => {
          cy.getBySel(`Navbar-${item.title}`)
            .should("contain.text", item.title)
            .click()
            .then(async () => {
              if (item.slug !== "") {
                cy.url().should("contain", item.slug);
              }
            });
        })
      }

      for (const menuItem of nav.menu as NavbarItem[]) {
        cy
          .wait(300) // wait for async requests to finish
          .then(async () => {
            cy.getBySel(`Navbar-More`).trigger("mouseover");
            cy.getBySel('HoverMenu-MenuList').should("be.visible");
          })
          .then(async () => {
            cy.getBySel(`MenuItem-${menuItem.title}`)
            .click()
            .then(() => {
              if (menuItem.slug !== "") {
                cy.url().should("contain", menuItem.slug);
              }
            });
          })
      }
    });
  });
});
