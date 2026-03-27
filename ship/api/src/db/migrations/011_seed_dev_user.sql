-- Seed default dev user for initial login
-- Password: shipdev123 (bcrypt hashed)
INSERT INTO users (username, email, password)
VALUES (
  'dev',
  'dev@ship.local',
  '$2b$10$Zvb3swEpRr2VdsbqSV0XCOJtQtOADwodnM9bF1/Pn.8NomMglYMPa'
)
ON CONFLICT (email) DO NOTHING;
