import { createSignal, For, batch, onMount, onCleanup } from 'solid-js';
import OBR from '@owlbear-rodeo/sdk';
import { createConsumer } from '@rails/actioncable';

import './App.css'

function App() {
  const [region, setRegion] = createSignal('ru');
  const [campaignId, setCampaignId] = createSignal('');
  const [messages, setMessages] = createSignal([]);

  const connectToCable = () => {
    const consumer = createConsumer('ws://localhost:5000/cable');
    const campaignChannel = consumer.subscriptions.create(
      { channel: 'CampaignChannel', campaign_id: campaignId() },
      {
        connected() {
          console.log('Connected to the channel:', this);
        },
        disconnected() {
          console.log('Disconnected');
        },
        received(data) {
          if (data.message) setMessages([data.message].concat(messages()));
        }
      }
    )
  }

  onMount(() => {
    const readMetadata = async () => {
      const metadata = await OBR.room.getMetadata();
    
      batch(() => {
        setRegion(metadata.region);
        setCampaignId(metadata.charkeeperChannelId);
      });
      connectToCable();
    }

    const checkRoom = async () => {
      if (OBR.scene.messageBus.ready) {
        clearInterval(interval)

        readMetadata();
      }
    }
    const interval = setInterval(() => { checkRoom() }, 1000);
    
    onCleanup(() => clearInterval(interval));
  });

  const checkCampaign = () => {
    const url = `http://localhost:5000/owlbear/campaigns/${campaignId()}`;
    return fetch(url, { method: 'GET' })
      .then((response) => response.json())
      .then((data) => data)
      .catch(() => { return { errors_list: ['Internal server error, an error report has been sent to the developer!'] } });
  }

  const submitCampaign = async () => {
    const role = await OBR.player.getRole();
    if (role !== 'GM') return setMessages(['Forbidden'].concat(messages())); // disable for users
    if (campaignId().length === 0) return; // disable for empty ID

    const result = await checkCampaign();
    if (!!result.errors) {
      setMessages(result.errors.concat(messages()));
    } else {
      await OBR.room.setMetadata({ 'region': region(), 'charkeeperChannelId': campaignId() });
      connectToCable();
    }
  }

  return (
    <>
      <div id="login">
        <select value={region()} onInput={(e) => setRegion(event.currentTarget.value)}>
          <For each={['en', 'ru']}>
            {(option) => <option value={option}>{option}</option>}
          </For>
        </select>
        <input placeholder="Campaign ID" value={campaignId()} onInput={(e) => setCampaignId(e.target.value)} />
        <p onClick={submitCampaign}>Connect</p>
      </div>
      <div id="content">
        <For each={messages()}>
          {(message) =>
            <div class="message" innerHTML={message} />
          }
        </For>
      </div>
    </>
  )
}

export default App
