import { HOME_REFERENCE_ASSETS } from '../../home/homeAssets';

export type HomeNotificationPreviewItem = {
  id: string;
  iconTone: string;
  iconKey: string;
  title: string;
  detail: string;
  dotTone: string;
  source?: string;
};

type Props = {
  notifications: HomeNotificationPreviewItem[];
  notificationCount: number;
  fieldName?: string;
  onOpen: () => void;
};

export default function HomeNotificationsCard({
  notifications,
  notificationCount,
  fieldName,
  onOpen,
}: Props) {
  return (
    <button
      type="button"
      className="tp-home-notifications-reference"
      onClick={onOpen}
    >
      <div
        className="tp-home-notifications-bg"
        aria-hidden="true"
        style={{
          backgroundImage: `url(${HOME_REFERENCE_ASSETS.notificationsBg})`,
        }}
      />
      <div className="tp-home-notifications-shade" aria-hidden="true" />

      <div className="tp-home-notifications-content">
        <div className="tp-home-notifications-head">
          <img
            className="tp-home-notifications-bell"
            src={HOME_REFERENCE_ASSETS.iconBell}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div className="tp-home-notifications-title">
            <small>BİLDİRİMLER</small>
            <strong>Bildirim Merkezi</strong>
          </div>
          <span className="tp-home-notifications-count">{notificationCount}</span>
          <span className="tp-home-notifications-arrow" aria-hidden="true">
            ›
          </span>
        </div>

        <p className="tp-home-notifications-subtitle">
          {notificationCount > 0
            ? fieldName
              ? `${fieldName} için güncel gelişmeler burada.`
              : 'Tarlanla ilgili güncel gelişmeler burada.'
            : 'Şu an önemli bir gelişme görünmüyor.'}
        </p>

        <div className="tp-home-notifications-list">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div className="tp-home-notification-row" key={notification.id}>
                <img
                  className={`tp-home-notification-row-icon ${notification.iconTone}`}
                  src={
                    notification.iconKey === 'rain'
                      ? HOME_REFERENCE_ASSETS.iconRain
                      : notification.iconKey === 'document'
                        ? HOME_REFERENCE_ASSETS.iconDocument
                        : HOME_REFERENCE_ASSETS.iconLeafGreen
                  }
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
                <span className="tp-home-notification-row-copy">
                  {fieldName && notification.source !== 'calendar' && (
                    <span className="tp-home-notification-field-name" title={fieldName}>
                      {fieldName}
                    </span>
                  )}
                  <strong>{notification.title}</strong>
                  <small>{notification.detail}</small>
                </span>
                <i className={notification.dotTone} aria-hidden="true" />
              </div>
            ))
          ) : (
            <div className="tp-home-notification-row">
              <img
                className="tp-home-notification-row-icon green"
                src={HOME_REFERENCE_ASSETS.iconLeafGreen}
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="tp-home-notification-row-copy">
                <strong>Her şey yolunda</strong>
                <small>Yeni bir gelişme olduğunda burada görünecek</small>
              </span>
              <i className="muted" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
